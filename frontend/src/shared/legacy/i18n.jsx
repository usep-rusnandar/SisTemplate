import React from "react";

/* Alamtri Geo Admin — lightweight i18n. English / Indonesian.
   t("key") returns the active-language string, falling back to the key itself. */

const STRINGS = {
  en: {
    // chrome
    "search": "Search", "search.ph": "Search anything…", "fullscreen": "Fullscreen",
    "theme": "Theme", "theme.light": "Light", "theme.dark": "Dark", "language": "Language",
    "notifications": "Notifications", "notifications.view": "View all notifications",
    "notifications.mark": "Mark all as read", "notifications.empty": "You're all caught up",
    "profile": "Profile", "changePassword": "Change password", "changeImage": "Change image",
    "logout": "Log out", "account": "Account", "lockScreen": "Lock screen",
    "sidebar.collapse": "Collapse sidebar", "sidebar.expand": "Expand sidebar",
    // nav
    "nav.dashboard": "Dashboard", "nav.superadmin": "Super Admin", "nav.modules": "Modules", "nav.permissions": "Permissions",
    "nav.menus": "Menus", "nav.languages": "Languages", "nav.languageText": "Language Text",
    "nav.emailTemplates": "Email Templates", "nav.emailSent": "Email Sent", "nav.reminderSent": "Reminder Sent", "nav.settings": "Settings",
    "nav.backgroundProcesses": "Background processes",
    "nav.administration": "Administration", "nav.users": "Users", "nav.roles": "Roles", "nav.vendorContacts": "Vendor Contacts", "nav.audit": "Audit Log",
    "nav.masterData": "Master Data", "nav.holiday": "Holiday",
    "nav.approval": "Approval",
    "nav.vendorDatabase": "Vendor Database", "nav.vendorInvitation": "Vendor Invitation", "nav.vendorImport": "Ariba Vendor Import", "nav.contractDashboard": "Contract Dashboard",
    "nav.trackerStep": "Proposal Tracker Step", "nav.trackerMethod": "Proposal Tracker Method",
    "nav.vendorRelationship": "Distributor Type", "nav.vendorDocReq": "Document Requirement",
    "nav.brand": "Brand",
    "nav.kbli": "KBLI",
    "nav.country": "Country",
    "nav.adminRegions": "Administrative Regions",
    "nav.province": "Province",
    "nav.city": "City / Regency",
    "nav.district": "District",
    "nav.village": "Village",
    "nav.specialRequirement": "Special Requirement",
    "nav.commodity": "Commodity",
    "nav.vendorStatus": "Vendor Status",
    "nav.kbliType": "KBLI Type",
    "nav.kbliStatus": "KBLI Status",
    "nav.tracker": "Proposal Tracker", "nav.trackerDashboard": "Proposal Tracker Dashboard", "nav.trackerProposals": "Proposal Tracker",
    "nav.trackerSla": "SLA Matrix", "nav.trackerOverdue": "Overdue Monitoring",
    "nav.vendor": "Vendor", "nav.vwDashboard": "Vendor Profile",
    "nav.contractMon": "Contract Monitoring", "nav.cmDashboard": "Monitoring Dashboard", "nav.cmDatabase": "Contract Database", "nav.cmExpiry": "Expiry Reminders", "nav.cmImport": "Import & Migration", "nav.cmMaterialSync": "Material Sync",
    "nav.cip": "Term Sheet", "nav.cipDashboard": "Term Sheet dashboard", "nav.cipWorkflow": "Term Sheet & Contract", "nav.cipTemplates": "Template Library", "nav.cipAuthorization": "Authorization Master",
    "nav.cipRepository": "Document Repository",
    // common actions
    "act.create": "Create", "act.createUser": "Create user", "act.createRole": "Create role",
    "act.refresh": "Refresh", "act.save": "Save changes", "act.cancel": "Cancel", "act.delete": "Delete",
    "act.edit": "Edit", "act.reset": "Reset", "act.apply": "Apply", "act.export": "Export",
    "act.filters": "Filters", "act.clear": "Clear", "act.permissions": "Permissions",
    "common.actions": "Actions", "common.status": "Status", "common.createdAt": "Created at",
    "common.role": "Role", "common.email": "Email", "common.username": "Username", "common.fullName": "Full name",
    "common.active": "Active", "common.inactive": "Inactive", "common.suspended": "Suspended",
    "common.all": "All", "common.showing": "Showing", "common.of": "of", "common.results": "results",
    "common.page": "Page", "common.rowsPerPage": "Rows per page",
    // page descriptions
    "users.desc": "Manage user accounts, roles, and access across the platform.",
    "roles.desc": "Define roles, module scope, and permission sets that govern access.",
    "modules.desc": "Manage the business modules available across roles and navigation.",
    "perms.desc": "All permission keys available in the system, grouped by module.",
    "dash.welcome": "Welcome back", "dash.subtitle": "Here's what's happening across your workspace today.",
  },
  id: {
    "search": "Cari", "search.ph": "Cari apa saja…", "fullscreen": "Layar penuh",
    "theme": "Tema", "theme.light": "Terang", "theme.dark": "Gelap", "language": "Bahasa",
    "notifications": "Notifikasi", "notifications.view": "Lihat semua notifikasi",
    "notifications.mark": "Tandai semua dibaca", "notifications.empty": "Tidak ada yang baru",
    "profile": "Profil", "changePassword": "Ubah kata sandi", "changeImage": "Ubah foto",
    "logout": "Keluar", "account": "Akun", "lockScreen": "Kunci layar",
    "sidebar.collapse": "Ciutkan sidebar", "sidebar.expand": "Bentangkan sidebar",
    "nav.dashboard": "Dasbor", "nav.superadmin": "Super Admin", "nav.modules": "Module", "nav.permissions": "Hak Akses",
    "nav.menus": "Menu", "nav.languages": "Bahasa", "nav.languageText": "Teks Bahasa",
    "nav.emailTemplates": "Templat Email", "nav.emailSent": "Email Terkirim", "nav.reminderSent": "Reminder Terkirim", "nav.settings": "Pengaturan",
    "nav.backgroundProcesses": "Proses latar",
    "nav.administration": "Administrasi", "nav.users": "Pengguna", "nav.roles": "Peran", "nav.vendorContacts": "Kontak Vendor", "nav.audit": "Log Audit",
    "nav.masterData": "Data Master", "nav.holiday": "Hari Libur",
    "nav.approval": "Persetujuan",
    "nav.vendorDatabase": "Database Vendor", "nav.vendorInvitation": "Undangan Vendor", "nav.vendorImport": "Import Vendor Ariba", "nav.contractDashboard": "Dasbor Kontrak",
    "nav.trackerStep": "Tahapan Proposal Tracker", "nav.trackerMethod": "Metode Proposal Tracker",
    "nav.vendorRelationship": "Tipe Distributor", "nav.vendorDocReq": "Persyaratan Dokumen",
    "nav.brand": "Merek",
    "nav.kbli": "KBLI",
    "nav.country": "Negara",
    "nav.adminRegions": "Wilayah Administrasi",
    "nav.province": "Provinsi",
    "nav.city": "Kota / Kabupaten",
    "nav.district": "Kecamatan",
    "nav.village": "Kelurahan / Desa",
    "nav.specialRequirement": "Persyaratan Khusus",
    "nav.commodity": "Komoditas",
    "nav.vendorStatus": "Status Vendor",
    "nav.kbliType": "Tipe KBLI",
    "nav.kbliStatus": "Status KBLI",
    "nav.tracker": "Proposal Tracker", "nav.trackerDashboard": "Dasbor Proposal Tracker", "nav.trackerProposals": "Daftar Proposal",
    "nav.trackerSla": "Matriks SLA", "nav.trackerOverdue": "Pemantauan Overdue",
    "nav.vendor": "Vendor", "nav.vwDashboard": "Profil Vendor",
    "nav.contractMon": "Contract Monitoring", "nav.cmDashboard": "Dasbor Monitoring", "nav.cmDatabase": "Database Kontrak", "nav.cmExpiry": "Pengingat Berakhir", "nav.cmImport": "Import & Migrasi", "nav.cmMaterialSync": "Sinkronisasi Material",
    "nav.cip": "Term Sheet", "nav.cipDashboard": "Dasbor Term Sheet", "nav.cipWorkflow": "Term Sheet & Kontrak", "nav.cipTemplates": "Pustaka Template", "nav.cipAuthorization": "Master Authorization",
    "nav.cipRepository": "Repositori Dokumen",
    "act.create": "Buat", "act.createUser": "Buat pengguna", "act.createRole": "Buat peran",
    "act.refresh": "Muat ulang", "act.save": "Simpan perubahan", "act.cancel": "Batal", "act.delete": "Hapus",
    "act.edit": "Ubah", "act.reset": "Atur ulang", "act.apply": "Terapkan", "act.export": "Ekspor",
    "act.filters": "Filter", "act.clear": "Bersihkan", "act.permissions": "Hak akses",
    "common.actions": "Aksi", "common.status": "Status", "common.createdAt": "Dibuat pada",
    "common.role": "Peran", "common.email": "Email", "common.username": "Nama pengguna", "common.fullName": "Nama lengkap",
    "common.active": "Aktif", "common.inactive": "Nonaktif", "common.suspended": "Ditangguhkan",
    "common.all": "Semua", "common.showing": "Menampilkan", "common.of": "dari", "common.results": "hasil",
    "common.page": "Halaman", "common.rowsPerPage": "Baris per halaman",
    "users.desc": "Kelola akun pengguna, peran, dan akses di seluruh platform.",
    "roles.desc": "Tetapkan peran, cakupan module, dan kumpulan hak akses yang mengatur akses.",
    "modules.desc": "Kelola module bisnis yang tersedia untuk peran dan navigasi.",
    "perms.desc": "Semua kunci hak akses dalam sistem, dikelompokkan per modul.",
    "dash.welcome": "Selamat datang kembali", "dash.subtitle": "Berikut aktivitas di ruang kerja Anda hari ini.",
  },
};

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
];

const I18nCtx = React.createContext({ lang: "en", setLang: () => {}, t: (k) => k });

function I18nProvider({ children, defaultLang = "en", storageKey = "ag_lang" }) {
  const [lang, setLangState] = React.useState(() => window.__procurementStorage.getItem(storageKey) || defaultLang);
  const setLang = React.useCallback((l) => {
    setLangState(l);
    try { window.__procurementStorage.setItem(storageKey, l); } catch (e) {}
  }, [storageKey]);
  const t = React.useCallback((k) => (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.en[k] || k, [lang]);
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}
function useI18n() { return React.useContext(I18nCtx); }

/* tt(en, id) — quick bilingual helper bound to the active language. Shared so any
   bundle (internal or external) can use it without pulling in module-specific files. */
function useTT() {
  const { lang } = useI18n();
  return React.useCallback((en, id) => (lang === "id" ? (id != null ? id : en) : en), [lang]);
}

export { LANGS, I18nProvider, useI18n, useTT };
Object.assign(window, { LANGS, I18nProvider, useI18n, useTT });
