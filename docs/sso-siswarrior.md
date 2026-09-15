# SISWarrior SSO — konfigurasi & cara uji

Integrasi SSO JWT SISWarrior dengan **saklar boolean** `SSO:Enabled`, sesuai
spesifikasi tim security. Semua perilaku SSO diimplementasikan di
`SsoMiddleware` (`Platform/InternalIdentity/Infrastructure/Sso/`) dan hanya
aktif ketika `Enabled = true`.

Aturan praktis: **SSO tetap jalur utama di Production.** Saat `SSO:Enabled=true`,
halaman login internal **tidak ditampilkan** — SPA langsung ke SISWarrior.
Login lokal (NRP/email + password) hanya tampil ketika SSO off. `dev-login`
tanpa sandi **hanya** Development dengan `Auth:AllowPasswordlessDevLogin=true`.

## Perilaku per mode

| | `Enabled: true` | `Enabled: false` |
|---|---|---|
| SPA `/api/v1/internal/auth/me` tanpa sesi | 200 JSON `isAuthenticated: false`, `ssoEnabled: true` → SPA langsung `/sso/login` (spinner, tanpa form login) | 200 JSON, unauthenticated → form login |
| API internal lain tanpa sesi | 302 → `{SsoUrl}?application=…&redirectUrl=…` | Tidak ada redirect |
| Login lokal `POST /api/v1/internal/auth/login` | Tersedia (hash + lockout + Active) | Tersedia |
| Callback `?token=<JWT>` | Validasi bentuk + kedaluwarsa → simpan ke session (`SsoJwtToken`) → map NRP→PersonnelNo → 302 ke URL bersih tanpa `token` | Diabaikan |
| Token expired / NRP tak ter-mapping | 401 / 403 (JSON) | — |
| Session JWT | Dikelola middleware | Tidak diwajibkan |
| Session lokal (personnel + display name) | Valid meski SSO on | Valid |
| Bypass | health, openapi/swagger/scalar, `/api/v1/vendor/*`, auth login/me/logout/password-policy/password-reset/dev-login, `/sso/login`, `/sso/callback`, static asset, favicon | Sama |

Request API yang sudah terautentikasi cookie identitas vendor tidak
di-redirect ke SSO — otorisasi endpoint yang memutuskan.

## Contoh appsettings

**Production / server testing internal (terintegrasi portal):**

```json
"SSO": {
  "Enabled": true,
  "SsoUrl": "https://app-saptaindra.msappproxy.net/SISwarrior/auth/redirect",
  "ApplicationUrl": "http://<host-internal>/",
  "Application": "IntegratedProcurement"
}
```

`ApplicationUrl` adalah fallback `redirectUrl` (biasanya Suite). Tambahkan
setiap origin portal yang PIC Auth daftarkan ke `AllowedApplicationUrls`.
`/sso/login` mengirim host request itu bila ada di allowlist — bukan selalu
Suite. Middleware menangkap `token=` di path mana pun pada AppHost; ModuleGateway
menulis ulang `/?token=` ke `/api/v1/internal/sso/callback`.

**Staging (PIC Auth sudah daftar 4 host, `Enabled` tetap false sampai di-flip):**

```json
"SSO": {
  "Enabled": false,
  "SsoUrl": "https://app-saptaindra.msappproxy.net/SISApps-Test/auth/redirect",
  "ApplicationUrl": "https://contractone-staging.azurewebsites.net/",
  "AllowedApplicationUrls": [
    "https://contractone-staging.azurewebsites.net/",
    "https://proposal-tracker-staging.azurewebsites.net/",
    "https://vendor-onboarding-staging.azurewebsites.net/",
    "https://contract-monitoring-staging.azurewebsites.net/"
  ],
  "Application": "Contract One"
}
```

Nyalakan Staging lewat App Setting sticky `SSO__Enabled=true` (jangan commit
`Enabled: true` kecuali diminta). Jika Azure sudah overlay `SSO__SsoUrl` /
`SSO__Application`, nilainya harus SISApps-Test / Contract One.

**Dev lokal (tanpa portal):**

```json
"SSO": {
  "Enabled": false
}
```

`SsoUrl`/`ApplicationUrl`/`Application` tidak dipakai saat `Enabled: false`.

## NRP = PersonnelNo (fakta penting)

**NRP dan PersonnelNo adalah nilai yang SAMA** — "NRP" hanyalah nama lama dari
PersonnelNo. Formatnya: **8 digit angka**, boleh berawalan nol (mis. `00109610`,
`01111041`; awalan bervariasi 0/1/8/…). Karena identik, **tidak ada tabel
pemetaan** NRP↔PersonnelNo: NRP dari JWT langsung dicocokkan ke
`iam.USER_T.PersonnelNo`.

> ⚠️ **Leading zero = simpan sebagai teks.** `PersonnelNo` wajib string, jangan
> pernah angka. Pencocokan dengan NRP dari JWT bersifat **exact string**, jadi
> `00109610` ≠ `109610`. Saat mengimpor data user (mis. dari Excel), pastikan
> kolom PersonnelNo bertipe *Text* agar nol depan tidak hilang — kalau hilang,
> login SSO orang tersebut gagal.

## Kontrak akses portal: `dbo.CEK_USER_ACCESS_FN(@NRP)`

Portal memeriksa hak akses aplikasi lewat scalar function ini (mengembalikan
`'true'`/`'false'`). Karena NRP = PersonnelNo, function cukup memeriksa
`iam.USER_T` **langsung** by PersonnelNo (Active + belum dihapus) — tanpa join
ke tabel mapping. Logika ini identik dengan gate runtime
`InternalUserAccessService.MapNrpAsync`.

- Deploy otomatis via migration `20260709014500_SimplifyCekUserAccessFnToDirectLookup`
  (menggantikan `20260708075412_AddCekUserAccessFn` yang versi join).
- Referensi ops: `tools/database/cek-user-access-fn.sql`.
- Tabel `iam.SSO_NRP_MAPPING_T` sudah **dihapus** (migration
  `20260709023727_DropSsoNrpMappingTable`) — tidak ada lagi konsep pemetaan NRP.

> **Prasyarat go-live SSO:** `iam.USER_T` harus berisi user internal asli dengan
> `PersonnelNo` = NRP 8-digit sungguhan (data saat ini masih demo `P-0000N`).
> User yang NRP-nya tidak ada / nonaktif akan berakhir 403 "SSO user is not mapped".

## Ringkasan cara uji

**Mode `Enabled: false` (dev / fallback password):**
1. Jalankan backend; buka SPA internal → halaman login (NRP/email + password)
   muncul, tidak ada redirect ke SISWarrior.
2. Super Admin set password di Administration ▸ Users, atau staf memakai
   Forgot password (email reset, sama seperti vendor). Lalu login dengan
   identifier + password (`POST /api/v1/internal/auth/login`).
3. `dev-login` (`POST /api/v1/internal/auth/dev-login`) hanya ada di Development
   dengan `Auth:AllowPasswordlessDevLogin=true` — bukan fallback Production.

**Mode `Enabled: true` (testing/production):**
1. Buka SPA internal tanpa session → `GET /api/v1/internal/auth/me` 200
   (`isAuthenticated: false`, `ssoEnabled: true`) → **tidak ada form login**,
   SPA langsung `{SsoUrl}?application=…&redirectUrl=…` (`redirectUrl` = host
   portal yang sedang dibuka, jika ada di allowlist). API internal lain tanpa
   sesi → 302 ke SISWarrior (document) / 401 JSON (fetch).
2. Login portal → kembali ke host itu `?token=<JWT>` → URL bersih dan sesi
   cookie di host itu. Logout / session expired mengulangi redirect SSO.
3. Form login lokal **tidak** tampil di UI ketika SSO on (`POST /auth/login`
   tetap ada di API).
4. Token expired → 401; NRP yang tidak ada di `USER_T` / user nonaktif → 403
   "SSO user is not mapped".
5. Verifikasi function: `SELECT dbo.CEK_USER_ACCESS_FN(N'<NRP-8-digit-valid>')` →
   `true`; NRP tak dikenal / user nonaktif / nol depan hilang → `false`.
