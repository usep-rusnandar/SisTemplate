# Menjalankan Frontend Jadi Satu dengan Backend

> Ringkasan cepat cara mem-bundle **SPA internal** ke dalam backend (AppHost) sehingga tampil satu origin
> (SPA di `/`, API di `/api/*`, tanpa CORS). Untuk deployment detail lihat `deployment-guide.md`,
> `deployment-vscode.md` (Azure App Service), atau `deployment-iis-internal.md` (IIS on-prem).

## Bagaimana mekanismenya

Backend (`src/AppHost`) memanggil `InternalFrontendHosting.UseInternalFrontend()` yang menyajikan hasil
build SPA internal + fallback `index.html` untuk client-side routing (kecuali `/api/*` tetap 404).
Root SPA di-resolve berurutan (yang pertama punya `index.html` dipakai):

1. Config **`Frontend:InternalDistPath`** — path eksplisit (opsional, untuk produksi).
2. **`{ContentRoot}/wwwroot`** — hasil `dotnet publish` (lihat Cara 2).
3. **`{repo}/Code/frontend/dist/internal`** — layout repo saat development (Cara 1).

Kalau tidak ada `index.html` di ketiganya → backend jalan **API-only** (halaman `/` kosong/404).
Hanya SPA **internal** yang dibundel; portal **vendor (external)** deploy terpisah (lihat `deployment-topology.md`).

## Cara 1 — Development lokal (satu proses)

**Sekali perintah** (dari `Code/frontend`): build SPA internal lalu jalankan backend yang menyajikannya:

```bash
cd Code/frontend
npm run serve
```

`serve` = `npm run build:internal && dotnet run --project ../backend/src/AppHost`. Backend memakai
`ASPNETCORE_ENVIRONMENT=Development` otomatis (dari launchSettings). Buka URL yang tercetak di console —
default **http://localhost:5055** / **https://localhost:7055** → SPA di `/` + API di `/api/*` satu origin.

Versi manual (kalau ingin langkah terpisah):

```bash
cd Code/frontend && npm run build:internal   # → Code/frontend/dist/internal
cd ../backend && dotnet run --project src/AppHost
```

- Wajib environment **Development** (`dotnet run` sudah memakainya via launchSettings) supaya connection
  string dev (GENERAL_LEDGER_DB) & seed aktif.
- Setiap kali frontend diubah, **build ulang** `npm run build:internal` lalu refresh browser.
- Untuk iterasi frontend yang cepat, alternatifnya: jalankan Vite dev server terpisah
  (`npm run dev`) dan biarkan backend API-only — tapi ini **bukan** mode "jadi satu".

## Cara 2 — Publish (deploy jadi satu artefak)

```bash
# 1) Build SPA internal DULU
cd Code/frontend && npm run build:internal

# 2) Publish backend — MSBuild target PublishInternalFrontend otomatis
#    menyalin frontend/dist/internal → <output>/wwwroot
cd ../backend && dotnet publish src/AppHost -c Release -o ../publish/internal
```

Hasilnya di `Code/publish/internal` sudah berisi backend + `wwwroot` (SPA). Jalankan
`IntegratedProcurement.AppHost.Api.dll` di situ (set `ASPNETCORE_ENVIRONMENT` sesuai target:
Staging/Production; file `appsettings.{env}.json` / App Service settings menyediakan connection string).

> `npm run build` (tanpa `:internal`) menjalankan `tsc` + build **internal & external** sekaligus —
> pakai ini kalau butuh dua-duanya; untuk bundling ke backend cukup `build:internal`.

## Urutan itu penting

**Selalu build frontend DULU, baru `dotnet run` / `dotnet publish`.** Kalau `dotnet publish` jalan
sebelum `frontend/dist/internal` ada, `wwwroot` kosong → halaman utama blank/404 aset.

## Troubleshooting

| Gejala | Sebab | Solusi |
|--------|-------|--------|
| Halaman `/` blank atau 404 aset | `dist/internal`/`wwwroot` belum ada | Build SPA dulu (`npm run build:internal`), lalu run/publish |
| Log backend: *"Internal frontend build not found — running API-only"* | Ketiga kandidat root tak punya `index.html` | Build SPA, atau set `Frontend:InternalDistPath` ke folder yang benar |
| Deep-link (mis. `/tracker`) 404 saat refresh | — | Sudah ditangani SPA fallback; kalau tetap, pastikan disajikan lewat `UseInternalFrontend` (bukan static host lain) |
| `/api/...` malah balik HTML | Fallback keliru | Path `/api/*` sudah dikecualikan dari fallback; cek route benar-benar diawali `/api` |
