# SharePoint Integration — App Registration & Credential Setup

**Tujuan:** Integrated Procurement (modul **Contract Monitoring → Import & Migration**) perlu mengunduh
file dokumen kontrak yang tersimpan di **SharePoint Online** (site `ProcurementSourcingDocument`),
lalu menyimpannya ke **Azure Blob Storage**. File Excel hasil export hanya berisi *sharing link*
(`https://saptaindra.sharepoint.com/:b:/s/ProcurementSourcingDocument/...`), bukan file fisik.

Akses dilakukan **app-only** (tanpa user login) lewat **Microsoft Graph API**. Dokumen ini untuk
**tim Infra / Admin Microsoft 365** untuk menyiapkan App Registration + izin + kredensial.

> Pola autentikasi mengikuti yang sudah dipakai untuk Azure Blob:
> **Dev = Client Secret**. **Target akhir Production = Managed Identity** (tanpa secret).
>
> **Go Live sementara (2026-09-04, CM-SP-1):** Managed Identity Graph masih error dan PIC auth
> sedang tidak di kantor. Staging + Production memakai **App Registration + Client Secret**
> (overlay App Setting `SharePoint__ClientSecret` per slot `contractone`). Balik ke MI dengan
> workflow **Clear SharePoint App Settings** setelah grant MI sudah diverifikasi.

---

## Ringkasan yang harus diserahkan kembali ke developer

Setelah langkah di bawah selesai, kirim ke developer:

| Item | Contoh | Untuk |
|------|--------|-------|
| **Directory (tenant) ID** | `xxxxxxxx-xxxx-...` | semua |
| **Application (client) ID** | `xxxxxxxx-xxxx-...` | semua |
| **Client Secret (value)** | `abc8Q~...` | **Dev saja** |
| **Konfirmasi izin sudah di-*admin consent*** | ✔ | semua |
| **Konfirmasi mode izin** | `Sites.Selected` atau `Sites.Read.All` | semua |
| **(Prod) Object ID Managed Identity app** | `xxxxxxxx-...` | grant Sites.Selected ke MI |

---

## Langkah 1 — Buat App Registration (Microsoft Entra ID)

1. Buka **portal.azure.com** → **Microsoft Entra ID** → **App registrations** → **+ New registration**.
2. **Name:** `IntegratedProcurement-SharePoint`.
3. **Supported account types:** *Accounts in this organizational directory only (Single tenant)*.
4. **Redirect URI:** kosongkan (ini app-only, bukan login user).
5. **Register**.
6. Di halaman **Overview**, catat **Application (client) ID** dan **Directory (tenant) ID**.

---

## Langkah 2 — Beri izin Microsoft Graph (Application permission)

> Pilih **SALAH SATU** mode. **Rekomendasi: Opsi A (`Sites.Selected`)** — paling aman (hanya site
> `ProcurementSourcingDocument`, bukan seluruh SharePoint tenant).

### Opsi A — `Sites.Selected` (least privilege, direkomendasikan)

1. Di app → **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Application permissions**.
2. Cari & centang **`Sites.Selected`** → **Add permissions**.
3. Klik **Grant admin consent for <tenant>** → **Yes**. Status harus jadi hijau "Granted".
4. **Grant akses ke site spesifik** (lihat **Langkah 4** — wajib untuk `Sites.Selected`).

### Opsi B — `Sites.Read.All` (lebih simpel, tenant-wide read)

1. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Application permissions**.
2. Cari & centang **`Sites.Read.All`** → **Add permissions**.
3. Klik **Grant admin consent for <tenant>** → **Yes**.
4. (Langkah 4 **tidak perlu** untuk opsi ini.)

> Catatan: jangan pakai **Delegated** permission — integrasi ini berjalan tanpa user yang login.

---

## Langkah 3 — Kredensial

### Dev — Client Secret

1. Di app → **Certificates & secrets** → **Client secrets** → **+ New client secret**.
2. **Description:** `dev-secret`, **Expires:** 6–12 bulan (sesuai kebijakan).
3. **Add** → **segera salin kolom *Value*** (hanya tampil sekali). Kirim ke developer secara aman.

### Production — Managed Identity (tanpa secret)

> **PENTING:** Managed Identity (MI) adalah **service principal TERPISAH** dari App Registration
> `IntegratedProcurement-SharePoint`. App Registration + Client Secret **tidak dipakai di prod**.
> Karena itu, **izin SharePoint harus di-grant lagi ke identitas MI** — kalau tidak, prod akan `403`.

**3a. Pilih jenis Managed Identity**
- **System-assigned:** menempel ke resource App Service/Container App; ikut terhapus bila resource dihapus. Cukup untuk satu aplikasi.
- **User-assigned (disarankan):** resource MI berdiri sendiri, stabil lintas redeploy, bisa dipakai beberapa service. Punya **Client ID** sendiri (dibutuhkan aplikasi untuk memilih MI yang tepat).

**3b. Aktifkan MI di resource hosting**
- App Service / Container App → **Identity**:
  - System-assigned: **Status = On** → catat **Object (principal) ID**.
  - User-assigned: **+ Add** lalu pilih MI → catat **Client ID** dan **Object ID** MI.
- Mengaktifkan MI otomatis membuat **service principal** di Entra ID. Tidak ada secret yang dibuat.

**3c. Grant izin Graph ke service principal MI** (ulangi untuk identitas MI, bukan App Registration)
- **Opsi A (`Sites.Selected`):** lakukan grant per-site (lihat **Langkah 4c**) menggunakan **Client ID milik MI**.
- **Opsi B (`Sites.Read.All`):** assign app role Graph `Sites.Read.All` ke service principal MI. Ini
  **tidak bisa** lewat UI "API permissions" (itu untuk App Registration) — gunakan Microsoft Graph PowerShell:
  ```powershell
  Connect-MgGraph -Scopes "Application.ReadWrite.All","AppRoleAssignment.ReadWrite.All"
  $graph = Get-MgServicePrincipal -Filter "appId eq '00000003-0000-0000-c000-000000000000'"  # Microsoft Graph
  $role  = $graph.AppRoles | Where-Object { $_.Value -eq "Sites.Read.All" -and $_.AllowedMemberTypes -contains "Application" }
  $miObjectId = "<OBJECT_ID_MANAGED_IDENTITY>"
  New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $miObjectId `
     -PrincipalId $miObjectId -ResourceId $graph.Id -AppRoleId $role.Id
  ```

> Production tidak menyimpan secret apa pun — `DefaultAzureCredential` di aplikasi otomatis memakai
> Managed Identity (lewat IMDS). Sama persis dengan setup Azure Blob. Untuk **user-assigned** MI,
> aplikasi diberi tahu Client ID MI lewat config `SharePoint:ManagedIdentityClientId`.

---

## Langkah 4 — Grant akses ke site `ProcurementSourcingDocument` (HANYA untuk Opsi A `Sites.Selected`)

`Sites.Selected` tidak memberi akses apa pun sampai admin meng-grant per-site. Lakukan dengan
**salah satu** cara berikut (perlu admin dengan hak Graph `Sites.FullControl.All`, mis. via Graph Explorer).

### 4a. Cari Site ID

`GET https://graph.microsoft.com/v1.0/sites/saptaindra.sharepoint.com:/sites/ProcurementSourcingDocument`

Salin nilai `id` (format: `saptaindra.sharepoint.com,<guid>,<guid>`).

### 4b. Grant role "read" ke aplikasi (untuk Dev — pakai Client/App ID)

`POST https://graph.microsoft.com/v1.0/sites/{siteId}/permissions`

```json
{
  "roles": ["read"],
  "grantedToIdentities": [
    { "application": { "id": "<APPLICATION_CLIENT_ID>", "displayName": "IntegratedProcurement-SharePoint" } }
  ]
}
```

### 4c. (Prod) Grant role "read" ke Managed Identity

Sama seperti 4b, tetapi `application.id` = **Application/Client ID dari Managed Identity** (untuk
user-assigned MI gunakan client ID-nya; untuk system-assigned, daftarkan service principal-nya).

> Alternatif tanpa Graph Explorer: **PnP PowerShell**
> `Grant-PnPAzureADAppSitePermission -AppId <clientId> -DisplayName "IntegratedProcurement-SharePoint" -Site "https://saptaindra.sharepoint.com/sites/ProcurementSourcingDocument" -Permissions Read`

---

## Langkah 5 — Verifikasi (opsional, oleh infra)

1. Ambil token app-only:
   ```
   POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
   Body (x-www-form-urlencoded):
     client_id={clientId}
     client_secret={secret}
     scope=https://graph.microsoft.com/.default
     grant_type=client_credentials
   ```
2. Uji unduh dari salah satu link Excel. Sharing URL diubah jadi *share token*:
   `u!` + base64(URL) yang di-url-safe-kan (`+`→`-`, `/`→`_`, hapus `=` di akhir).
   ```
   GET https://graph.microsoft.com/v1.0/shares/{shareToken}/driveItem/content
   Authorization: Bearer {token}
   ```
   Berhasil = balasan 302/200 berisi byte file. Itu artinya kredensial + izin sudah benar.

---

## Konfigurasi aplikasi (diisi developer)

`appsettings.json` (prod — tanpa secret, pakai Managed Identity):
```json
"SharePoint": {
  "TenantId": "<tenant-id>",
  "ManagedIdentityClientId": "<client-id-user-assigned-MI>"  // hapus/null bila pakai system-assigned MI
}
```

`appsettings.Development.json` (dev — **tidak masuk git**, sudah di-gitignore):
```json
"SharePoint": {
  "TenantId": "<tenant-id>",
  "ClientId": "<app-registration-client-id>",
  "ClientSecret": "<secret-value>"
}
```

Aplikasi memilih kredensial otomatis:

- Ada `ClientSecret` + `ClientId` + `TenantId` → `ClientSecretCredential` — identitas = **App Registration**
  `IntegratedProcurement-SharePoint`. Ini jalur Development, dan jalur yang sama untuk **Staging /
  Production** bila App Setting `SharePoint__ClientSecret` diisi (per slot).
- Tidak ada secret → `ManagedIdentityCredential` **saja** (system-assigned, atau user-assigned bila
  `ManagedIdentityClientId` di-set). **Bukan** `DefaultAzureCredential`. DAC mencoba
  EnvironmentCredential / WorkloadIdentity dulu; slot App Service sering punya `AZURE_CLIENT_ID`
  parsial (atau terisi Client ID App Registration), sehingga muncul error
  *Environment variables are not fully configured* dan token tidak pernah didapat.

Staging dan Production **masing-masing slot** punya identity sendiri. Nyalakan Identity di slot
staging; identity production tidak menular ke slot.

Graph `401 Unauthorized` setelah token berhasil didapat = identitas itu **tidak punya app role
Graph** (`Sites.Read.All` atau `Sites.Selected` + grant site). MI App Service tidak mewarisi izin
App Registration — grant ulang ke MI (Langkah 3c) **atau** set `SharePoint__ClientSecret` supaya
aplikasi memakai App Registration yang sudah di-grant.

### Overlay App Setting (tanpa commit secret)

Nilai secret **jangan** masuk `appsettings.*.json`. Pasang di App Service `contractone` saja
(module portal tidak perlu):

| Aksi | GitHub Action | Confirm input |
|---|---|---|
| Go Live / MI masih error | **Set SharePoint Client Secret** | `SET-BOTH` |
| MI sudah OK, cabut overlay | **Clear SharePoint App Settings** | `CLEAR-BOTH` |

GitHub secret `SHAREPOINT_CLIENT_SECRET` harus berisi *Value* App Registration yang sama
dengan yang lolos uji token + `GET /sites/.../ProcurementSourcingDocument`. Portal setara:
Configuration → Application settings → `SharePoint__ClientSecret` (sticky per slot), lalu Restart.

---

## Setelah ini selesai (pekerjaan developer)

Begitu Tenant ID + Client ID (+ secret untuk dev) diterima & izin di-consent, developer mengimplementasikan:

- `ISharePointDocumentFetcher` (backend) → resolve sharing link via Graph `/shares/{token}/driveItem/content`.
- Pada **Import & Migration**: untuk setiap baris dengan *Link Document*, unduh file dari SharePoint →
  upload ke Azure Blob (container `app-contractmanagement`) → simpan `blobKey` di Contract Version
  (menggantikan penyimpanan link mentah saat ini).
- Penanganan throttling (HTTP 429) + retry untuk migrasi massal.

---

## Catatan keamanan / hal yang perlu diperhatikan

- **Least privilege:** utamakan `Sites.Selected` agar app hanya bisa membaca site Procurement, bukan
  seluruh SharePoint organisasi.
- **Admin consent wajib** — tanpa itu, semua panggilan Graph akan gagal `403`.
- **Secret hanya untuk App Registration.** Masa berlaku terbatas — pasang reminder rotasi.
  Target akhir Production tanpa secret (Managed Identity). Selama **CM-SP-1**, secret hidup
  sebagai App Setting overlay + GitHub secret `SHAREPOINT_CLIENT_SECRET`, **bukan** di git.
  Nilai yang pernah di-paste di chat sebaiknya dirotasi di Entra setelah Go Live, lalu
  GitHub secret + App Setting di-update.
- Sharing link bertipe "specific people"/expiring tetap bisa diunduh app-only **asalkan** app punya
  hak baca site-nya (itulah fungsi `Sites.Selected`/`Sites.Read.All`); endpoint `/shares/{token}`
  me-resolve item berdasarkan identitas app, bukan audience link.
- Jangan commit secret apa pun ke git (`appsettings.Development.json` sudah di-`.gitignore`).
