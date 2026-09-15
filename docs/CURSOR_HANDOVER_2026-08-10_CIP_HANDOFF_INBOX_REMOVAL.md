# Handover ke Cursor AI — Penghapusan Total CIP Handoff Inbox

Tanggal: 10 Agustus 2026  
Workspace: `D:\Projects\IntegratedProcurement\Code`  
Branch: `master`  
Commit terakhir sebelum pekerjaan ini: `c45c674 fix(tracker): accept LOA browser timestamps`

## 1. Keputusan user yang bersifat final

User memutuskan menu dan halaman **Handoff Inbox** di modul CIP tidak dipertahankan. Hapus fitur ini secara penuh, bukan hanya menyembunyikan menunya.

Yang harus dihapus:

- menu, route, title/i18n, halaman, dan tombol menuju Handoff Inbox;
- helper frontend khusus inbox dan pembentukan CIP Case dari LOA;
- endpoint backend `GET /api/v1/contract-initiation-platform/loa-inbox`;
- endpoint backend `POST /api/v1/contract-initiation-platform/cases/from-loa`;
- service/result/repository method yang hanya mendukung kedua endpoint tersebut;
- test lama yang menguji pembuatan CIP Case dari LOA;
- dokumentasi API aktif yang masih menyatakan endpoint tersebut tersedia.

Flow bisnis yang dipertahankan:

1. Proposal Tracker menyelesaikan Bid Evaluation atau Negotiation.
2. Finalize Award membentuk CIP Case per vendor pemenang melalui `POST /cases/from-award-result`.
3. CIP memproses Termsheet.
4. Setelah Termsheet selesai, LOA di Tracker dan Contract di CIP berjalan paralel.
5. LOA yang kemudian dihasilkan di Tracker **tidak membentuk CIP Case baru**. LOA harus terlihat sebagai dokumen pendukung dari CIP Case yang sudah ada, terutama melalui **Document Repository**.

Jangan menghapus data transaksi LOA atau CIP Case yang sudah ada.

## 2. Kondisi working tree saat handover

Pekerjaan belum selesai, belum dibuild, belum dites, dan belum di-commit.

File yang sudah dimodifikasi:

- `frontend/src/app/legacy/App.jsx`
- `frontend/src/modules/contract-initiation-platform/legacy/ContractCIPData.jsx`
- `frontend/src/modules/contract-initiation-platform/legacy/ContractCIPScreens.jsx`
- `frontend/src/modules/contract-initiation-platform/legacy/ContractCIPWorkflow.jsx`
- `frontend/src/platform/navigation/legacy/MenuData.jsx`
- `frontend/src/shared/legacy/i18n.jsx`

Folder `publish/` sudah untracked sebelum pekerjaan ini. Jangan dihapus, dipindah, atau dimasukkan ke commit.

Ringkasan diff saat handover: 28 insertions, 413 deletions pada enam file frontend.

## 3. Perubahan yang sudah dilakukan

### Navigasi dan route frontend

- Node default menu `cipInbox` sudah dihapus dari `MenuData.jsx`.
- `cipInbox` ditambahkan ke `RETIRED_MENU_KEYS`. Ini penting agar menu lama yang tersimpan di backend/frontend-state ikut dipangkas saat menu dimuat, tanpa perlu mengedit JSON seed besar secara manual.
- Mapping permission `cipInbox` sudah dihapus.
- Route dan title `cipInbox` sudah dihapus dari `App.jsx`.
- Terjemahan `nav.cipInbox` Inggris/Indonesia sudah dihapus.
- Tombol `Open Handoff Inbox` di workflow sudah diganti menjadi `Open Document Repository` dan mengarah ke `cipRepository`.

### Halaman dan dashboard CIP

- Komponen `CIPInbox` sudah dihapus seluruhnya dari `ContractCIPScreens.jsx`.
- Export global `CIPInbox` sudah dihapus.
- Tombol hero dashboard yang sebelumnya menuju Inbox sudah diganti menjadi Document Repository.
- Panel `LOA intake` di dashboard sudah diganti menjadi `Latest documents`, memakai hasil `cipRepositoryDocs(cases)`.

### Helper data frontend

Helper legacy berikut sudah dihapus dari `ContractCIPData.jsx`:

- `cipBuildCaseFromLoaItem`
- `cipSeedStore`
- `cipCreateCasesFromAward` yang hanya dipakai halaman inbox lama
- `cipNextCaseId`
- `cipSameLoaCase`
- `cipCreateCaseFromLoa`
- `cipTrackerTermsheetReady`
- `cipTrackerHandoffReady`
- `cipTrackerLoaLinkReady`
- `cipAwardTermsheetInbox`
- `cipLoaInbox`

Export global terkait sudah dihapus. Seed source/fallback store diubah dari `tracker-loa` menjadi `tracker-award`.

Catatan: `cipCreateCasesFromAward` frontend sengaja dihapus karena flow aktif sudah memanggil backend finalization dari Proposal Tracker, bukan dari halaman inbox CIP.

## 4. Pekerjaan backend yang belum dilakukan

### Hapus endpoint lama

Di `backend/src/AppHost/Endpoints/CipEndpoints.cs` hapus:

- mapping `GET /loa-inbox`;
- mapping `POST /cases/from-loa`;
- method `CreateCipCaseFromLoaAsync`;
- helper `ToInboxItem`;
- request record `CreateCaseFromLoaRequest`;
- response record `CipLoaInboxDomainItem`.

### Hapus application service lama

Di `backend/src/Modules/ContractInitiationPlatform/Application/CipCaseService.cs`:

- hapus seluruh `CreateFromLoaAsync`;
- perbarui XML summary class agar menyebut create from award, bukan create from Tracker LOA;
- pada `CreateFromAwardResultAsync`, ubah komentar “same shape as the LOA inbox id” menjadi “stable per-winner linkage key” atau setara;
- jangan menghapus dependency `ITrackerLoaReadPort`, karena `GetProposalAsync` masih digunakan oleh flow award dan `GetWorkflowAsync` masih digunakan endpoint list case.

Di `CipCaseResults.cs`, hapus `CipCreateFromLoaResult` dan komentarnya.

### Bersihkan read port Tracker

Di `ITrackerLoaReadPort.cs`:

- hapus `FindLoaByIdAsync`, karena hanya digunakan create-from-LOA;
- pertahankan `ListLoaDocumentsAsync`, tetapi ubah dokumentasinya dari “CIP LOA inbox” menjadi “CIP Document Repository”;
- tambahkan `PayloadJson` ke `TrackerLoaView`. Payload ini berisi `Container`, `BlobKey`, dan payload LOA yang diperlukan agar dokumen bisa dibuka dari repository;
- pertahankan `GetProposalAsync` dan `GetWorkflowAsync`.

Di `TrackerLoaReadAdapter.cs`:

- hapus implementasi `FindLoaByIdAsync`;
- tambahkan `item.PayloadJson` pada projection `TrackerLoaView` di `ListLoaDocumentsAsync`.

### Bersihkan repository CIP

Di `ICipRepository.cs` dan `CipRepository.cs`, hapus `GetLinkedLoaKeysAsync`. Method ini hanya mendukung flag `HasCipCase` pada inbox lama.

Pertahankan `GetCaseByLoaKeyAsync`, karena flow `CreateFromAwardResultAsync` masih memakainya untuk idempotensi per proposal/vendor.

### Bersihkan static read model legacy

Di `backend/src/AppHost/ReadModels/ModuleWorkflowReadModels.cs`, hapus jika tidak ada pemakai lain:

- `CipLoaInbox()`;
- `CreateCipCaseFromLoa(string loaId)`.

Jangan menghapus istilah “handoff” generik yang masih menjelaskan integrasi modul aktif. Yang dihapus adalah fitur/page/API **Handoff Inbox** dan create case dari LOA.

## 5. Pekerjaan penting: tampilkan LOA di Document Repository

Saat ini endpoint CIP repository hanya mengembalikan `cip.CASE_DOCUMENT_T`. CIP Case aktif dibentuk saat award, sedangkan LOA dibuat belakangan di `trk.LOA_DOCUMENT_T`; akibatnya LOA baru tidak otomatis menjadi row di `cip.CASE_DOCUMENT_T`.

Solusi yang disepakati: buat read projection di endpoint repository, tanpa menyalin atau menghapus transaksi.

Ubah `GET /api/v1/contract-initiation-platform/repository` di `CipEndpoints.cs` agar:

1. membaca seluruh CIP cases dari `ICipRepository.ListCasesAsync()`;
2. membaca dokumen CIP existing dari `ListAllDocumentsAsync()`;
3. membaca LOA Tracker dari `ITrackerLoaReadPort.ListLoaDocumentsAsync()`;
4. mencocokkan LOA ke case dengan linkage key `${ProposalKey}-${VendorId}` terhadap `CipCase.LoaKey`;
5. menambahkan LOA sebagai `CipCaseDocumentDomainItem` bertipe `loa` untuk case yang cocok;
6. jangan membuat duplikat apabila case sudah punya document type `loa`;
7. parse `Container` dan `BlobKey` dari `TrackerLoaView.PayloadJson` menggunakan `JsonDocument`/`JsonNode` secara aman;
8. gunakan file name dan generatedAt dari row LOA Tracker; size boleh `0` karena entity Tracker saat ini tidak menyimpan ukuran file;
9. pertahankan `PayloadJson` agar frontend bisa membaca metadata/payload LOA.

Frontend sebenarnya sudah siap menerima hasil tersebut:

- `cipRefreshDomainCases()` mengambil `/cases` dan `/repository`;
- `cipAttachDomainDocuments()` sudah mengenali `documentType === "loa"` dan menempelkan `loaFileName`, `loaContainer`, `loaBlobKey`, serta `loaPayload` ke case;
- `cipRepositoryDocs(cases)` kemudian menampilkan LOA di Document Repository dan latest documents dashboard.

Opsional tetapi direkomendasikan: gunakan projection LOA yang sama di `GET /cases/{caseId}` agar detail API case juga mencantumkan LOA pendukung. Jika ini dilakukan, buat helper bersama agar logika join/parse tidak diduplikasi.

## 6. Test yang harus diubah/ditambahkan

File: `backend/tests/AppHost/DomainCommandEndpointTests.cs`

Hapus test lama:

- `CipCreateCaseFromLoaPersistsCaseDocumentAndActivity`

Ganti dengan test yang membuktikan:

1. seed satu Tracker proposal, satu winner-linked CIP Case (`LoaKey = $"{proposalKey}-{vendorId}"`), dan satu Tracker LOA document;
2. `GET /api/v1/contract-initiation-platform/repository` mengembalikan item:
   - `caseKey` milik CIP Case tersebut;
   - `documentType == "loa"`;
   - nama file LOA;
   - `container` dan `blobKey` dari `PayloadJson`;
3. `GET /api/v1/contract-initiation-platform/loa-inbox` mengembalikan 404;
4. `POST /api/v1/contract-initiation-platform/cases/from-loa` mengembalikan 404.

Pastikan test flow award (`from-award-result`) dan sinkronisasi completion Tracker/CIP tetap lulus.

## 7. Dokumentasi yang harus diperbarui

Dokumentasi aktif:

- `WORK.md`: hapus kalimat bahwa legacy LOA-created cases masih didukung; tulis bahwa case hanya berasal dari award result dan LOA diproyeksikan ke repository.
- `docs/phase-2-manifest-and-contracts.md`: hapus baris `/loa-inbox` dan `/cases/from-loa`.
- `docs/phase-6-completed-modules-api-driven-frontend.md`: hapus kedua endpoint lama dan dokumentasikan repository projection.

File `docs/PROJECT_HANDOVER_2026-06-*.md` adalah snapshot historis. Jangan mengubahnya kecuali user meminta pembersihan histori dokumentasi; keberadaan istilah lama di sana bukan runtime feature.

## 8. Pemeriksaan frontend yang masih wajib

Jalankan ulang pencarian:

```powershell
rg -n "cipInbox|CIPInbox|Handoff Inbox|loa-inbox|cases/from-loa|CreateFromLoa|CipCreateFromLoa|GetLinkedLoaKeys|cipLoaInbox|cipAwardTermsheetInbox|cipCreateCaseFromLoa|FindLoaByIdAsync" frontend/src backend/src backend/tests docs WORK.md --glob '!backend/src/AppHost/App_Data/frontend-state.json'
```

Targetnya tidak ada referensi runtime/test aktif. Kemunculan `cipInbox` di `RETIRED_MENU_KEYS` harus tetap ada agar persisted menu lama dibersihkan.

Periksa juga header comment paling atas `ContractCIPScreens.jsx`; saat handover masih mungkin menyebut “LOA Inbox” dan harus dibersihkan.

Jangan mengedit `backend/src/AppHost/App_Data/frontend-state.json` hanya untuk membuang menu lama. `RETIRED_MENU_KEYS` sudah menjadi mekanisme migrasi yang benar untuk state menu tersimpan.

## 9. Build, test, dan browser verification

Belum ada build/test setelah perubahan parsial ini. Setelah semua coding selesai:

```powershell
dotnet build backend/IntegratedProcurement.sln
dotnet test backend/tests/AppHost/AppHost.Tests.csproj --no-restore
npm --prefix frontend run build
```

Lakukan smoke test browser di `http://localhost:8008`:

- login sebagai Super Admin/CIP role;
- pastikan Handoff Inbox hilang dari sidebar;
- buka CIP Dashboard dan pastikan tombol menuju Document Repository;
- buka Document Repository dan pastikan LOA Tracker yang terhubung ke case tampil;
- klik Open pada LOA dan pastikan URL dokumen berhasil di-resolve;
- buka CIP Workflow dan pastikan tidak ada tombol/link menuju route `cipInbox`;
- periksa console dan network, tidak boleh ada error atau request ke endpoint lama.

Backend sebelumnya berjalan di port `5055` dan frontend dev server di port `8008`. Karena pekerjaan belum selesai, proses yang sedang hidup mungkin masih menjalankan build lama. Restart backend setelah build baru berhasil; frontend dev server biasanya HMR tetapi tetap verifikasi prosesnya.

## 10. Git handoff

Setelah build/test/browser lulus:

```powershell
git status --short
git diff --check
git diff --stat
```

Commit yang disarankan:

```text
refactor(cip): retire handoff inbox
```

Jangan push; user melakukan push sendiri. Jangan sertakan folder `publish/` pada commit.

## 11. Data dan konteks yang tidak boleh rusak

- Jangan menghapus row LOA yang sudah dibuat di Tracker.
- Jangan menghapus CIP Case aktif yang bersumber dari `tracker-bidevaluation` atau `tracker-negotiation`.
- Sebelum handover ini sudah ada LOA transaksi untuk proposal `2026/S.03.02/GeneralAffair/JAHO/001`; dokumen tersebut harus tetap dapat ditemukan setelah Inbox dihapus.
- Temporary E-Proposal views untuk proses video masih menggunakan suffix `_sim`, termasuk `vw_ProposalHeader_sim`, `vw_ProposalVendor_sim`, dan `vw_ProposalMaterial_sim`. Jangan mengubahnya dalam task ini.
- Jangan menyentuh perubahan lain di luar task dan jangan melakukan destructive git commands.

## 12. Definisi selesai

Task dianggap selesai hanya bila:

- menu/page/route Handoff Inbox tidak ada;
- endpoint inbox dan create-from-LOA benar-benar 404;
- tidak ada service/result/repository code khusus legacy tersebut;
- case tetap dibentuk dari award result;
- LOA Tracker yang cocok tampil dan dapat dibuka dari CIP Document Repository;
- build frontend/backend dan seluruh test lulus;
- browser smoke test bersih;
- perubahan di-commit tanpa `publish/` dan tanpa push.
