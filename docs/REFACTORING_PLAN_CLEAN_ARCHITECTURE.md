# Refactoring Plan — Menuju Clean Architecture Modular Monolith (Asli)

**Date:** 2026-06-24
**Author:** Claude (Senior Software Architect)
**Scope:** Backend `Code/backend`. Internal refactor — **TANPA mengubah kontrak HTTP atau UI frontend**.
**Baseline assessment:** lihat penilaian arsitektur (skor ~4/10): 23 dari 37 project kosong, God-DbContext (34 DbSet), logika di AppHost, domain entity di `Persistence/Support`, coupling lintas-modul via DbContext bersama.

> **Tujuan:** mengubah "architecture theater" menjadi Clean Architecture Modular Monolith yang nyata, **inkremental & dapat dibatalkan**, satu modul per fase, build + test selalu hijau.

---

## 0. Prinsip & Aturan Main

1. **Kontrak tidak berubah.** Semua endpoint + bentuk request/response tetap → frontend tidak disentuh. Refactor murni internal.
2. **Inkremental.** Satu modul/fase. Tidak ada big-bang. Tiap fase: build 0 error + 28 test hijau + smoke.
3. **Dependency Rule:** `Domain` tak bergantung apa pun; `Application` → Domain; `Infrastructure` → Application+Domain; `AppHost` → semua, tapi tak ada arah balik.
4. **Module owns its data & logic.** Tidak ada modul membaca tabel modul lain langsung.
5. **Tes mengunci hasil.** Tambah architecture tests agar regresi struktur tertahan otomatis.

---

## Target Bentuk Per Modul

```
Modules/<Module>/
  Domain/         entities, value objects, domain events, REPOSITORY INTERFACES (ports)
  Application/    use-cases (command/query handlers), DTO, application ports (IAuditWriter, INotificationPublisher, ...)
  Infrastructure/ EF IEntityTypeConfiguration (milik modul), implementasi repository
AppHost/Endpoints/<Module>Endpoints.cs   → TIPIS: deserialize → panggil use-case → return
```

Cross-cutting ports (interface) hidup di `BuildingBlocks.Application`; implementasi (Blob, SMTP, EF) di Infrastructure terkait.

---

## Keputusan yang Perlu Dikonfirmasi (sebelum eksekusi)

| # | Keputusan | Rekomendasi | Alasan |
|---|---|---|---|
| K1 | **Strategi persistence** | **B2** dulu: tetap **satu** `ProcurementDbContext` fisik, tapi **config EF + akses via repository dipindah ke Infrastructure tiap modul**. (B1 = DbContext per-modul, ditunda.) | Isolasi modul besar tercapai, tapi tetap satu migration history & transaksi mudah. B1 berisiko tinggi (migrasi/transaksi lintas-context). |
| K2 | **Project kosong** | **Isi** yang dipakai (Tracker/CIP/CM/Platform inti); **hapus** yang benar-benar tak dipakai (mis. `Platform/Documents/*` bila Documents tak jadi modul terpisah — fold ke BuildingBlocks/Platform). | Jangan biarkan cangkang kosong (menyesatkan). |
| K3 | **Urutan modul** | Pilot **Contract Monitoring** (paling kecil) → lalu **Tracker** (terbesar/teruji) → **CIP** (workflow terpanjang). | Validasi pola di slice kecil sebelum yang besar. |
| K4 | **Komunikasi lintas-modul** | **Read-port** dulu (Tracker expose `ILoaInboxQuery`; CIP depend ke abstraksi). Integration event menyusul bila perlu write-handoff. | Hilangkan baca `trk.*` langsung dari CIP dengan risiko minimal. |

---

## Fase 0 — Guardrails (prasyarat, 0 perubahan perilaku)

**Tujuan:** kunci aturan + siapkan referensi pola.
1. Tambah project test `tests/Architecture` memakai **NetArchTest.Rules** (atau setara) dengan aturan:
   - `*.Domain` tidak mereferensikan `*.Application`/`*.Infrastructure`/EFCore/AppHost.
   - `*.Application` hanya boleh ke Domain + BuildingBlocks.Application.
   - `*.Infrastructure` tidak direferensikan balik oleh Domain/Application.
   - Tidak ada modul mereferensikan namespace modul lain (kecuali kontrak yang ditunjuk).
2. Jalankan — saat ini kemungkinan **gagal** (mendokumentasikan utang). Jadikan baseline; tiap fase mengurangi pelanggaran.

**DoD:** test arsitektur ada + jalan (boleh "expected failures" terdaftar). Build hijau.

---

## Fase 1 — Relokasi Domain Entity Platform (mekanis, risiko rendah)

**Masalah:** entity `NotificationEntry`, `SettingEntry`, `MenuTreeEntry`, `MasterData*`, `CommunicationEntries` ada di `Platform/Persistence/Support` (infrastruktur); `Audit` entity di `Platform/Audit/Domain` (sudah benar).

**Langkah:**
1. Pindahkan tiap entity → `Platform/<X>/Domain` (Notifications, Settings, Administration/MasterData, Communication→? tentukan modulnya).
2. Pindahkan `IEntityTypeConfiguration`-nya dari `Persistence/Configurations/SupportConfiguration.cs` → `Platform/<X>/Infrastructure`.
3. `Persistence` meng-`ApplyConfigurationsFromAssembly` dari assembly Infrastructure tiap Platform (sudah ada satu assembly; tambah pemindaian assembly lain) — atau registrasi eksplisit.
4. Build + test (tidak ada perubahan skema → migrasi tidak berubah; hanya pemindahan tipe + namespace).

**Risiko:** namespace berubah → update `using`. Tidak ada perubahan DB.
**DoD:** entity platform tinggal di Domain masing-masing; `Persistence/Support` menyusut; build+test hijau.

---

## Fase 2 — Repository Ports per Modul (pola B2)

**Tujuan:** modul mengakses datanya lewat abstraksi, bukan `DbContext` mentah di endpoint.

**Per modul (mulai CM):**
1. Definisikan interface di `Domain` (mis. `IContractRepository`, `IContractReminderRepository`) — method sesuai kebutuhan use-case.
2. Implementasikan di `Infrastructure` (inject `ProcurementDbContext` — tetap satu context untuk B2; repo hanya menyentuh entity miliknya).
3. Pindahkan `IEntityTypeConfiguration` modul (mis. `ContractMonitoringDomainConfiguration`) dari `Persistence/Configurations` → `Modules/ContractMonitoring/Infrastructure`. `Persistence` memindai assembly Infrastructure modul untuk config.
4. Registrasi repo + config di DI (extension `AddContractMonitoringModule()` di Infrastructure modul; dipanggil `Program.cs`).
5. Build + test.

**DoD:** config & akses data modul dimiliki Infrastructure modul; `Persistence` jadi "host" (DbContext + migrations + agregasi config), bukan pemilik logika modul.

---

## Fase 3 — Ekstraksi Use-Case ke Application (manfaat terbesar)

**Tujuan:** logika command pindah dari `AppHost/Endpoints` + `AppHost/Services` ke `Modules/<M>/Application` sebagai handler; endpoint jadi tipis.

**Per modul:**
1. Identifikasi command/query (mis. CM: `SendContractReminder`, `RunReminderScan`, `ImportContracts`, `GetContracts`).
2. Buat handler di `Application` (mis. `SendContractReminderHandler`) yang depend ke: repository ports (Domain) + cross-cutting ports (`IAuditWriter`, `INotificationPublisher`, `IDocumentStorage`, `IEmailSender` — interface di `BuildingBlocks.Application`).
3. Pindahkan logika dari endpoint/AppHost Service ke handler. Endpoint: `deserialize → handler.Handle(cmd) → map ke response`. **Bentuk response tetap.**
4. Pindahkan cross-cutting impl (Blob/SMTP/EF audit/notification) ke Infrastructure terkait; AppHost hanya wiring DI.
5. Tambah **unit test** handler (kini bisa diuji tanpa HTTP). Integration test lama tetap hijau.
6. Build + test + smoke.

**Catatan:** `AppHost/Services/AdminConsole*` → `Platform/Administration/Application`+`Infrastructure`; `NotificationService` → `Platform/Notifications/*`; `DocumentStorage`/`EmailSender`/`RetentionService` → Platform terkait. Permission infra (`Auth/*`) boleh tetap di AppHost (concern web).

**DoD:** AppHost endpoint tipis; logika modul di Application; AdminConsole/Notification/Document/Email/Retention pindah ke Platform layer; `AppHost/Services` menyusut drastis.

---

## Fase 4 — Kontrak Lintas-Modul

**Masalah:** CIP membaca `trk.LOA_DOCUMENT_T` langsung (via DbContext bersama) → batas modul bocor.

**Langkah:**
1. Tracker `Application` mem-publish **read-port** `ILoaInboxQuery` (DTO LOA siap-handoff) di tempat yang bisa dilihat CIP (project kontrak kecil `Modules/_Contracts` atau `BuildingBlocks.Application`).
2. CIP `Application` depend ke `ILoaInboxQuery` (abstraksi), bukan tabel `trk.*`.
3. AppHost wire implementasi Tracker.
4. (Opsional) Untuk write-handoff: domain/integration event `LoaIssued` → handler CIP (in-process mediator/dispatcher).

**DoD:** tidak ada modul membaca skema modul lain langsung; lintas-modul lewat kontrak.

---

## Fase 5 — (Opsional) Isolasi Persistence Penuh (B1)

Hanya jika benar-benar butuh DB-per-module:
- DbContext per modul (schema sendiri) + migration history terpisah.
- Transaksi lintas-modul via outbox/eventual consistency.
**Risiko tinggi** — lakukan setelah B2 stabil dan ada kebutuhan nyata.

---

## Fase 6 — Cleanup & Enforce

1. Hapus project kosong yang tak jadi dipakai (sesuai K2); rapikan solution folders.
2. Aktifkan architecture tests sebagai **gate CI** (gagal = PR ditolak).
3. Perbarui handover + diagram.

---

## Ringkasan Urutan Eksekusi

```
Fase 0  Guardrails (arch tests)                         [semua modul]
Fase 1  Relokasi entity platform → Domain               [Notifications, Settings, MasterData, Communication]
Fase 2  Repo ports + config per-modul (B2)              [CM → Tracker → CIP, lalu Platform]
Fase 3  Use-cases ke Application; tipiskan AppHost       [CM → Tracker → CIP; lalu AdminConsole/Notif/Doc/Email/Retention]
Fase 4  Kontrak lintas-modul (LOA read-port)            [Tracker→CIP]
Fase 5  (opsional) DbContext per-modul                  [bila perlu]
Fase 6  Cleanup project kosong + CI gate
```

Rekomendasi pilot: **Contract Monitoring** menembus Fase 2→3→(4 n/a) lebih dulu sebagai *reference vertical slice*; setelah polanya terbukti, terapkan ke Tracker lalu CIP.

---

## Estimasi & Risiko

| Fase | Effort relatif | Risiko | Catatan |
|---|---|---|---|
| 0 | Kecil | Rendah | murni tambah test |
| 1 | Kecil–sedang | Rendah | pindah tipe; tanpa perubahan DB |
| 2 | Sedang (per modul) | Rendah–sedang | satu context dipertahankan |
| 3 | **Besar** (per modul) | Sedang | inti; logika dipindah, kontrak tetap |
| 4 | Sedang | Sedang | abstraksi + wiring |
| 5 | Besar | **Tinggi** | opsional |
| 6 | Kecil | Rendah | cleanup |

**Pengaman risiko:** kontrak/endpoint/DTO tidak berubah → frontend aman; satu modul per fase → mudah revert; satu DbContext (B2) → tanpa kekacauan migrasi; arch tests cegah regresi.

---

## Definition of Done (tiap fase)
1. Build 0 error; **28+ test hijau** (Azure reachable).
2. Kontrak HTTP & UI tidak berubah (smoke per modul terdampak).
3. Architecture tests pelanggaran berkurang (tidak bertambah).
4. Handover/catatan diperbarui.

---

## Yang TIDAK termasuk
- Perubahan UI/desain frontend.
- Perubahan skema DB yang mengubah data (selain relokasi config).
- Modul Vendor (di-skip sampai diaktifkan).

---

## STATUS EKSEKUSI — SELESAI (2026-06-25)

Semua fase yang relevan untuk 3 modul MVP (Tracker/CIP/CM) telah dieksekusi. **Build 0 error/0 warning, 31 test hijau (3 architecture + 28 integration), kontrak HTTP tidak berubah** (diverifikasi via integration test + live smoke).

| Fase | Hasil |
|------|-------|
| **0 — Guardrail** | `tests/Architecture` (NetArchTest) — 3 test dependency-rule. ✅ |
| **1 — Relokasi entity platform** | Notification → `Platform/Notifications/Domain`; Setting → `Platform/Settings/Domain`; Menu + MasterData + Communication → `Platform/Administration/Domain`. Config tetap di Persistence (refs Domain satu arah). Migrasi kosong (schema-neutral) diterapkan ke Azure. `Persistence/Support` dihapus. ✅ |
| **2–3 — Pilot Contract Monitoring** | `IContractRepository` (Domain) + `ContractRepository` (Infrastructure) + use-cases `ContractReminderService`/`ContractImportService` (Application) + endpoint tipis. `ReminderPolicy` (Domain). ✅ |
| **2–3 — Replikasi Proposal Tracker** | `IProposalTrackerRepository` + `ProposalTrackerRepository` + `ProposalTrackerService` (Distribute/ClockIn/Complete/Recycle/Cancel/Reassign/GenerateLoa) + endpoint tipis. ✅ |
| **2–3 — Replikasi CIP** | `ICipRepository` + `CipRepository` + `CipCaseService` (FromLoa/Verify/Termsheet/Template/Draft/Final/Recycle) + `CipStagePolicy` (Domain) + endpoint tipis. ✅ |
| **4 — Read-port lintas-modul** | `ITrackerLoaReadPort` + DTO `TrackerLoaView`/`TrackerProposalView` (di `ProposalTracker.Application`), impl `TrackerLoaReadAdapter` (Tracker.Infrastructure). CIP membaca LOA/proposal Tracker **hanya** lewat port ini — tidak lagi menyentuh tabel Tracker langsung. ✅ |
| **DI** | `AddContractMonitoringModule` / `AddProposalTrackerModule` / `AddCipModule` dipanggil di `Program.cs` setelah `AddProcurementPersistence`. ✅ |

**Pola final tiap modul MVP:** AppHost endpoint (tipis) → Application use-case → Domain repository port → Infrastructure repo (ProcurementDbContext bersama, hanya menyentuh tabel modulnya). Cross-cutting (audit/notification/email) tetap di endpoint AppHost (concretion AppHost).

## EKSTRAKSI SERVICE PLATFORM — SELESAI (2026-06-25)

Semua service platform dikeluarkan dari AppHost ke shell `.Application`/`.Infrastructure` masing-masing. **Build 0 error; test 34 hijau (6 architecture + 28 integration); kontrak HTTP tetap.**

| Service | Tujuan | Pola |
|---|---|---|
| Documents (Blob) | `Platform.Documents` | wholesale (dep = IOptions) |
| Audit | `Platform.Audit` | adapter tipis di AppHost (HttpContext→IAuditTrail; view→AuditItem) |
| Notifications | `Platform.Notifications` | wholesale (488 baris) |
| Config + Email + Retention | `Platform.Administration` | wholesale (rantai) |
| AdminConsole CRUD (MasterData/Communication/IdentityRead/User/Role) | `Platform.Administration` | interface+DTO → Application, impl → Infrastructure; ReadModel bersama → Application; factory sample tetap di host |

**Guardrail arsitektur diperkuat: 6 architecture tests** menegakkan dependency rule untuk Domain & Application modul (+ isolasi modul), Domain & Application platform (termasuk Administration.Application), dan layering BuildingBlocks. Pelanggaran apa pun menggagalkan build.

**Kondisi akhir AppHost** = composition root murni: endpoint tipis + adapter audit (mapping HttpContext) + `AppReadinessService` + `VendorAuthService` (vendor, skip) + factory read-model sample + registrasi DI. **Tujuan Clean Architecture Modular Monolith tercapai & ditegakkan test.**

**Sisa (benar-benar opsional, non-blocking):**
- Fase 5 (DbContext per-modul) + pindah EF config & `DatabaseSchemas` ke Infrastructure modul / BuildingBlocks (B2 ditunda — modul memiliki *data access* via port).
- `AdminConsoleReadModels` (data sample canned di host) = sisa mockup yang bisa dibuat full DB-backed nanti (isu fungsional, bukan arsitektur).
- Hapus fungsi seed-generator frontend yang dead (uncalled).
- CI gate menjalankan architecture tests.
