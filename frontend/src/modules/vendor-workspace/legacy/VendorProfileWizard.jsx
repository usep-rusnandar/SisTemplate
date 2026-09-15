import React from "react";
import { useC, FONT, RADIUS } from "../../../shared/legacy/Tokens.jsx";
import { useI18n, useTT } from "../../../shared/legacy/i18n.jsx";
import { Icon, IconButton, Button, Field, TextInput, Textarea, Select, Checkbox, Badge, Card } from "../../../shared/legacy/Primitives.jsx";
import { Alert, Spinner, Modal, useToast } from "../../../shared/legacy/PrimitivesX.jsx";
import {
  VwApiDocRules, VwApiMasterSet, VwApiMapConfig, VwApiVendorMe, VwApiListDocs, VwApiSaveProfile,
  VwApiUploadDoc, VwApiDeleteDoc, VwOpenDoc, VwNormDateOnly, VwPortfolioOwnerKey,
  VwFmtMonthYearRange, VwIsOfficerPortfolio,
} from "./VendorOnboardingData.jsx";

/* Alamtri Geo Admin — Vendor Workspace: registration wizard (post-login).
   Mirrors the legacy VendorConnect wizard (_VendorWizardPartial.cshtml + wizard.js):
     1. Agreement            — declaration checkboxes + Pakta Integritas / Company Profile uploads
     2. Bio Data             — vendor info, logo, addresses (map picker), Commodity + Brand grids
     3. Persyaratan Umum     — NPWP (16 digits) / NIB / Akta / SPPKP + files, KBLI grid per commodity
     4. Persyaratan Khusus   — special requirements derived from the selected commodities + Sertifikat grid
     5. Portfolio of Project — portfolio grid, then Submit (SBMIT)
   Loads the profile from /api/v1/vendor-portal/profile, master data from
   /api/v1/master-data/sets/*, documents from /api/v1/vendor-portal/documents.
   Region fields hold master-data codes (the legacy region modal equivalent is the cascade). */

const VW_PROFILE_STEPS = [
  { key: "agreement", icon: "file-signature", en: "Agreement",             id: "Agreement" },
  { key: "biodata",   icon: "building-2",     en: "Bio Data",              id: "Bio Data" },
  { key: "umum",      icon: "scroll-text",    en: "General Requirements",  id: "Persyaratan Umum" },
  { key: "khusus",    icon: "shield-check",   en: "Specific Requirements", id: "Persyaratan Khusus" },
  { key: "portfolio", icon: "briefcase",      en: "Portfolio of Project",  id: "Portfolio of Project" },
];

// The registration popup is wide on desktop, so company and address details should use that
// horizontal space deliberately. The grid remains readable by stepping down for tablet/mobile.
const VW_WIZARD_LAYOUT_CSS = `
  .ag-vw-two-column-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .ag-vw-three-column-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .ag-vw-document-row-40-60,
  .ag-vw-document-row-30-20-50 {
    display: grid;
    gap: 12px;
    align-items: end;
  }
  .ag-vw-document-row-40-60 { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
  .ag-vw-document-row-30-20-50 { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) minmax(0, 5fr); }
  .ag-vw-grid-span-all { grid-column: 1 / -1; }
  @media (max-width: 1100px) {
    .ag-vw-three-column-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 680px) {
    .ag-vw-two-column-grid,
    .ag-vw-three-column-grid,
    .ag-vw-document-row-40-60,
    .ag-vw-document-row-30-20-50 { grid-template-columns: minmax(0, 1fr); }
  }
`;

/* legacy per-document constraints (extensions + max size in MB) */
const VW_FILE_RULES = {
  "pakta-integritas":    { accept: [".pdf"], maxMB: 5 },
  "company-profile":     { accept: [".pdf"], maxMB: 5 },
  "logo":                { accept: [".jpg", ".jpeg", ".png", ".gif"], maxMB: 500 / 1024 },
  "org-structure":       { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 5 },
  "npwp":                { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 5 },
  "nib":                 { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 5 },
  "akta-pendirian":      { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 10 },
  "akta-perubahan":      { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 10 },
  "akta-penyesuaian":    { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 10 },
  "sppkp":               { accept: [".pdf", ".jpg", ".jpeg", ".png"], maxMB: 5 },
  "brand":               { accept: [".jpg", ".jpeg", ".png", ".pdf"], maxMB: 5 },
  "kbli":                { accept: [".jpg", ".jpeg", ".png", ".pdf"], maxMB: 5 },
  "sertifikat":          { accept: [".jpg", ".jpeg", ".png", ".pdf"], maxMB: 5 },
  "portfolio":           { accept: [".jpg", ".jpeg", ".png", ".pdf"], maxMB: 5 },
  // 5MB, in line with every other certificate-shaped document. At 1MB a scanned certificate was
  // routinely rejected and the toast was easy to miss, so vendors believed the file had gone up.
  "special-requirement": { accept: [".jpg", ".jpeg", ".png", ".pdf"], maxMB: 5 },
};

/* The server owns these rules (GET /vendor-portal/documents/rules) and enforces them on upload; the
   map above is the offline default so a hint still renders if that call fails. Overlaying it keeps the
   portal from advertising a limit the server would then refuse. */
async function VwHydrateFileRules() {
  try {
    const rows = await VwApiDocRules();
    rows.forEach((row) => {
      if (!row || !row.docType) return;
      VW_FILE_RULES[row.docType] = {
        accept: Array.isArray(row.accept) && row.accept.length ? row.accept : (VW_FILE_RULES[row.docType] || {}).accept || [],
        maxMB: Number(row.maxBytes) / (1024 * 1024),
      };
    });
  } catch (e) { /* keep the built-in defaults */ }
  return VW_FILE_RULES;
}

/** "jpg, png, pdf · 5MB max" for a doc type — the single place upload hints are worded. */
function VwFileRuleHint(docType) {
  const rule = VW_FILE_RULES[docType];
  if (!rule) return "";
  const size = rule.maxMB < 1 ? `${Math.round(rule.maxMB * 1024)}KB` : `${rule.maxMB}MB`;
  return `${rule.accept.join(", ")} · ${size} max`;
}

/* Vendor Workspace free-text inputs are stored UPPERCASE (email excluded — never edited here). */
function vwAutoUpper(value) {
  return typeof value === "string" ? value.toUpperCase() : value;
}

/** Risk type "1RH" (description Rendah) — KBLI document optional; all others require a file. */
const VW_KBLI_LOW_RISK_TYPE = "1RH";
function vwKbliNeedsDocument(typeCode) {
  return String(typeCode || "").trim().toUpperCase() !== VW_KBLI_LOW_RISK_TYPE;
}

function VwCheckFile(file, docType) {
  const rule = VW_FILE_RULES[docType];
  if (!rule || !file) return null;
  const name = (file.name || "").toLowerCase();
  if (!rule.accept.some((ext) => name.endsWith(ext))) {
    return `${rule.accept.join(" / ")}`;
  }
  if (file.size > rule.maxMB * 1024 * 1024) {
    return `max ${rule.maxMB < 1 ? Math.round(rule.maxMB * 1024) + "KB" : rule.maxMB + "MB"}`;
  }
  return null;
}

/* ---------- Azure Maps SDK loader (CDN, injected once) ---------- */
let _vwAtlasPromise = null;
function VwLoadAtlas() {
  if (window.atlas) return Promise.resolve(window.atlas);
  if (_vwAtlasPromise) return _vwAtlasPromise;
  _vwAtlasPromise = new Promise((resolve, reject) => {
    try {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js";
      s.async = true;
      s.onload = () => resolve(window.atlas);
      s.onerror = () => reject(new Error("Azure Maps SDK failed to load"));
      document.head.appendChild(s);
    } catch (e) { reject(e); }
  });
  return _vwAtlasPromise;
}

function VwClampCoord(value, max) {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return Math.max(-max, Math.min(max, n));
}

function VwCoord6(value) {
  const n = parseFloat(value);
  return isNaN(n) ? "" : n.toFixed(6);
}

/* Country names in the master embed the dial code (e.g. "Indonesia (+62)"). Addresses want the
   plain name; the phone country selector wants the dial code. */
function VwCountryName(name) {
  return String(name || "").replace(/\s*\(\+?[\d\s-]+\)\s*$/, "").trim();
}

/* Standalone country list for the ADDRESS selectors. The dial-code master (used for phone codes)
   is keyed by calling code, so it merges/duplicates countries that share a code (US & Canada, the
   three Dominican Republic codes, …). Addresses need real country names, so we keep our own list. */
const VW_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Brazzaville)", "Congo (Kinshasa)",
  "Costa Rica", "Côte d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia",
  "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

function vwIsIndonesiaCountry(country) {
  return !country || !String(country).trim() || /indonesia/i.test(String(country));
}

function vwAddressInUse(addr) {
  if (!addr) return false;
  return !!(String(addr.address || "").trim()
    || addr.latitude != null
    || String(addr.provinceCode || "").trim()
    || String(addr.cityCode || "").trim()
    || String(addr.postCode || "").trim());
}

/* Azure Maps static image (Render v1) — used for the read-only preview once a location is picked. */
function VwStaticMapUrl(mapConfig, lat, lng, width, height, zoom) {
  const key = mapConfig && mapConfig.subscriptionKey;
  if (!key || lat == null || lng == null) return "";
  const w = width || 640, h = height || 200, z = zoom || 15;
  const pins = `default||${lng} ${lat}`;
  return "https://atlas.microsoft.com/map/static/png?api-version=1.0"
    + "&subscription-key=" + encodeURIComponent(key)
    + "&layer=basic&style=main&zoom=" + z
    + "&center=" + lng + "," + lat
    + "&width=" + w + "&height=" + h
    + "&pins=" + encodeURIComponent(pins);
}

/* ---------- location picker modal (mirrors the legacy VendorConnect picker) ---------- */
function VwMapPicker({ open, mapConfig, initialLat, initialLng, onConfirm, onClose }) {
  const C = useC();
  const tt = useTT();
  const mapRef = React.useRef(null);
  const mapObj = React.useRef(null);
  const DEFAULT = { lat: -6.2, lng: 106.8166 };
  const [lat, setLat] = React.useState(initialLat != null ? initialLat : DEFAULT.lat);
  const [lng, setLng] = React.useState(initialLng != null ? initialLng : DEFAULT.lng);
  const [query, setQuery] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [showList, setShowList] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState("");
  const suppressRef = React.useRef(false);
  const key = mapConfig && mapConfig.subscriptionKey;
  const country = (mapConfig && mapConfig.country) || "IDN";

  React.useEffect(() => {
    if (!open) return undefined;
    setLat(initialLat != null ? initialLat : DEFAULT.lat);
    setLng(initialLng != null ? initialLng : DEFAULT.lng);
    setQuery(""); setAddress(""); setSuggestions([]); setShowList(false); suppressRef.current = false;
    setMapReady(false);
    setMapError("");
    if (!key) { setMapError("nokey"); return undefined; }

    let cancelled = false;
    VwLoadAtlas()
      .then((atlas) => {
        if (cancelled || !mapRef.current) return;
        const startLat = initialLat != null ? initialLat : DEFAULT.lat;
        const startLng = initialLng != null ? initialLng : DEFAULT.lng;
        const map = new atlas.Map(mapRef.current, {
          center: [startLng, startLat],
          zoom: 15,
          style: "road",
          authOptions: { authType: "subscriptionKey", subscriptionKey: key },
        });
        mapObj.current = map;
        map.events.add("ready", () => {
          if (cancelled) return;
          setMapReady(true);
          map.events.add("moveend", () => {
            const c = map.getCamera().center;
            if (c) { setLat(c[1]); setLng(c[0]); }
          });
        });
      })
      .catch(() => { if (!cancelled) setMapError("load"); });

    return () => {
      cancelled = true;
      try { if (mapObj.current) { mapObj.current.dispose(); mapObj.current = null; } } catch (e) {}
    };
  }, [open, key]);

  // Reverse-geocode the current centre for the info card (debounced).
  React.useEffect(() => {
    if (!open || !key || lat == null || lng == null) return undefined;
    let cancelled = false;
    const id = setTimeout(() => {
      fetch("https://atlas.microsoft.com/search/address/reverse/json?api-version=1.0&subscription-key=" + encodeURIComponent(key) + "&query=" + lat + "," + lng)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { const a = d && d.addresses && d.addresses[0]; setAddress(a && a.address ? a.address.freeformAddress : ""); } })
        .catch(() => {});
    }, 500);
    return () => { cancelled = true; clearTimeout(id); };
  }, [open, key, lat, lng]);

  // Typeahead suggestions as the user types (>= 2 chars) — mirrors the legacy VendorConnect picker
  // (fuzzy search, countrySet, id-ID, typeahead=true, limit 8).
  React.useEffect(() => {
    if (!open || !key) return undefined;
    if (suppressRef.current) { suppressRef.current = false; return undefined; }
    const text = query.trim();
    if (text.length < 2) { setSuggestions([]); setShowList(false); return undefined; }
    let cancelled = false;
    const id = setTimeout(() => {
      fetch("https://atlas.microsoft.com/search/fuzzy/json?api-version=1.0&subscription-key=" + encodeURIComponent(key)
        + "&query=" + encodeURIComponent(text) + "&countrySet=" + encodeURIComponent(country) + "&language=id-ID&typeahead=true&limit=8")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const items = ((d && d.results) || [])
            .filter((r) => r.position)
            .map((r) => ({ name: (r.poi && r.poi.name) || "", address: (r.address && r.address.freeformAddress) || "", lat: r.position.lat, lng: r.position.lon }));
          setSuggestions(items); setShowList(items.length > 0);
        })
        .catch(() => { if (!cancelled) { setSuggestions([]); setShowList(false); } });
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [open, key, query, country]);

  const pick = (s) => {
    suppressRef.current = true;
    setQuery(s.name || s.address || "");
    setShowList(false); setSuggestions([]);
    if (mapObj.current) { try { mapObj.current.setCamera({ center: [s.lng, s.lat], zoom: 17 }); } catch (e) {} }
    setLat(s.lat); setLng(s.lng);
  };

  const doSearch = () => {
    if (!key || !query.trim() || searching) return;
    setShowList(false);
    setSearching(true);
    fetch("https://atlas.microsoft.com/search/fuzzy/json?api-version=1.0&limit=1&countrySet=" + encodeURIComponent(country) + "&subscription-key=" + encodeURIComponent(key) + "&query=" + encodeURIComponent(query.trim()))
      .then((r) => r.json())
      .then((d) => {
        const r = d && d.results && d.results[0];
        if (r && r.position) {
          const la = r.position.lat, ln = r.position.lon;
          if (mapObj.current) { try { mapObj.current.setCamera({ center: [ln, la], zoom: 17 }); } catch (e) {} }
          setLat(la); setLng(ln);
        }
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  };

  const zoomBy = (d) => {
    if (!mapObj.current) return;
    try { const cam = mapObj.current.getCamera(); mapObj.current.setCamera({ zoom: Math.max(1, Math.min(20, (cam.zoom || 15) + d)) }); } catch (e) {}
  };

  const applyManual = () => {
    const la = VwClampCoord(lat, 90);
    const ln = VwClampCoord(lng, 180);
    if (la == null || ln == null) return;
    if (mapObj.current) { try { mapObj.current.setCamera({ center: [ln, la], zoom: 16 }); } catch (e) {} }
    setLat(la); setLng(ln);
  };

  const overlayCard = { background: C.surface, borderRadius: RADIUS.md, boxShadow: C.shadowMd, border: `1px solid ${C.border}` };
  const zoomBtn = { ...FONT, width: 38, height: 38, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.shadowMd };

  return (
    <Modal open={open} onClose={onClose} title={tt("Pick Location", "Pilih Lokasi")} icon="map-pin" width={940}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
          <Button iconLeft="check" onClick={() => onConfirm(VwClampCoord(lat, 90), VwClampCoord(lng, 180))}>{tt("Confirm Location", "Konfirmasi Lokasi")}</Button>
        </div>
      }>
      {(mapError || !key) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Alert tone="info" title={tt("Enter coordinates manually", "Masukkan koordinat manual")}
            description={tt("Map is unavailable — type the latitude and longitude, or copy them from Google Maps.", "Peta tidak tersedia — ketik latitude & longitude, atau salin dari Google Maps.")} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <Field label="Latitude"><TextInput value={String(lat ?? "")} onChange={(e) => setLat(e.target.value)} placeholder="-6.200000" /></Field>
            <Field label="Longitude"><TextInput value={String(lng ?? "")} onChange={(e) => setLng(e.target.value)} placeholder="106.816600" /></Field>
            <Button variant="secondary" onClick={applyManual}>{tt("Apply", "Terapkan")}</Button>
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", height: 520, borderRadius: RADIUS.md, overflow: "hidden", border: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {/* centre pin */}
          {mapReady && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-100%)", pointerEvents: "none", zIndex: 5 }}>
              <Icon name="map-pin" size={38} color="#e11d48" />
            </div>
          )}
          {!mapReady && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner size={22} /></div>}

          {/* search bar + typeahead suggestions (above the lat/long + info overlays) */}
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 20, width: "min(560px, 82%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: RADIUS.pill, ...overlayCard }}>
              <input value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (suggestions.length) setShowList(true); }}
                onBlur={() => setTimeout(() => setShowList(false), 150)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } else if (e.key === "Escape") { setShowList(false); } }}
                placeholder={tt("Search a place or address…", "Cari tempat atau alamat…")}
                style={{ ...FONT, flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13.5, color: C.text, padding: "0 10px" }} />
              <Button onClick={doSearch} disabled={searching} style={{ borderRadius: RADIUS.pill }}>{searching ? <Spinner size={14} color="#fff" /> : tt("Search", "Cari")}</Button>
            </div>
            {showList && suggestions.length > 0 && (
              <div style={{ marginTop: 6, maxHeight: 320, overflowY: "auto", ...overlayCard }}>
                {suggestions.map((s, i) => (
                  <div key={i} onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 14px", cursor: "pointer", borderBottom: i < suggestions.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      {s.name && <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.name}</div>}
                      <div style={{ fontSize: s.name ? 12 : 13, color: s.name ? C.textMuted : C.text, lineHeight: 1.4 }}>{s.address}</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* coordinates + reverse-geocoded address */}
          {mapReady && (
            <div style={{ position: "absolute", top: 74, left: 14, zIndex: 10, maxWidth: 250, padding: "10px 12px", fontSize: 12.5, color: C.text, ...overlayCard }}>
              <div><b>Lat:</b> {VwCoord6(lat)}</div>
              <div><b>Lng:</b> {VwCoord6(lng)}</div>
              {address && <div style={{ marginTop: 6, color: C.textMuted, lineHeight: 1.45 }}>{address}</div>}
            </div>
          )}

          {/* manual latitude / longitude */}
          {mapReady && (
            <div style={{ position: "absolute", top: 74, right: 14, zIndex: 10, width: 210, padding: 12, display: "flex", flexDirection: "column", gap: 8, ...overlayCard }}>
              <Field label="Latitude"><TextInput value={String(lat ?? "")} onChange={(e) => setLat(e.target.value)} placeholder="-6.200000" /></Field>
              <Field label="Longitude"><TextInput value={String(lng ?? "")} onChange={(e) => setLng(e.target.value)} placeholder="106.816600" /></Field>
              <Button variant="secondary" size="sm" fullWidth onClick={applyManual}>{tt("Apply", "Terapkan")}</Button>
            </div>
          )}

          {/* zoom controls */}
          {mapReady && (
            <div style={{ position: "absolute", bottom: 14, right: 14, zIndex: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" title={tt("Zoom in", "Perbesar")} onClick={() => zoomBy(1)} style={zoomBtn}>+</button>
              <button type="button" title={tt("Zoom out", "Perkecil")} onClick={() => zoomBy(-1)} style={zoomBtn}>−</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------- one address block (legacy: address, country, region, post code, map) ---------- */
function VwAddressBlock({ title, addr, onChange, mapConfig, countries, tint }) {
  const C = useC();
  const tt = useTT();
  const [mapOpen, setMapOpen] = React.useState(false);
  const [provinces, setProvinces] = React.useState([]);
  const [cities, setCities] = React.useState([]);
  const [districts, setDistricts] = React.useState([]);
  const [villages, setVillages] = React.useState([]);
  const set = (k, v) => onChange({ ...addr, [k]: (k === "address" || k === "postCode") ? vwAutoUpper(v) : v });
  const isIndonesia = /indonesia/i.test(addr.country || "");
  const countryOpts = [{ value: "", label: tt("— select country —", "— pilih negara —") },
    ...VW_COUNTRIES.map((n) => ({ value: n, label: n }))];
  const regionOpts = (list) => [{ value: "", label: tt("— select —", "— pilih —") }, ...list.map((r) => ({ value: r.code, label: r.name }))];

  React.useEffect(() => { VwApiMasterSet("province", { take: 1000 }).then(setProvinces); }, []);
  React.useEffect(() => { if (addr.provinceCode) VwApiMasterSet("city", { parent: addr.provinceCode, take: 2000 }).then(setCities); else setCities([]); }, [addr.provinceCode]);
  React.useEffect(() => { if (addr.cityCode) VwApiMasterSet("district", { parent: addr.cityCode, take: 2000 }).then(setDistricts); else setDistricts([]); }, [addr.cityCode]);
  React.useEffect(() => { if (addr.districtCode) VwApiMasterSet("village", { parent: addr.districtCode, take: 4000 }).then(setVillages); else setVillages([]); }, [addr.districtCode]);

  const mapThumb = { width: "100%", height: 180, objectFit: "cover", display: "block" };
  return (
    <VwCard title={title} tint={tint}>
      <div className="ag-vw-two-column-grid">
        <Field label={tt("Address", "Alamat")}>
          <Textarea value={addr.address || ""} rows={5} style={{ height: 180, minHeight: 180, maxHeight: 180, resize: "none", overflowY: "auto", textTransform: "uppercase" }} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label={tt("Map", "Peta")}>
          {addr.latitude != null && addr.longitude != null ? (
            <div style={{ width: "100%", minWidth: 0 }}>
              <button type="button" onClick={() => setMapOpen(true)}
                style={{ ...FONT, display: "block", width: "100%", padding: 0, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", cursor: "pointer", background: C.surfaceAlt }}>
                <img src={VwStaticMapUrl(mapConfig, addr.latitude, addr.longitude, 1200, 360)} alt={tt("Selected location", "Lokasi terpilih")}
                  onError={(e) => { e.target.style.display = "none"; }}
                  style={mapThumb} />
              </button>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>
                <b style={{ color: C.text }}>{tt("Coordinates", "Koordinat")}:</b> {addr.latitude}, {addr.longitude}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setMapOpen(true)}
              style={{ ...FONT, width: "100%", height: 180, cursor: "pointer", border: `1.5px dashed ${C.border}`, background: C.surfaceAlt, borderRadius: RADIUS.md, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.text }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>🗺️</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{tt("Pick location", "Pilih lokasi")}</div>
            </button>
          )}
        </Field>
      </div>
      <div style={{ height: 12 }} />
      <div className="ag-vw-three-column-grid">
        <Field label={tt("Post code", "Kode pos")}>
          <TextInput value={addr.postCode || ""} maxLength={5} onChange={(e) => set("postCode", e.target.value)} />
        </Field>
        <Field label={tt("Country *", "Negara *")}>
          <Select value={addr.country || ""} options={countryOpts}
            onChange={(e) => onChange({ ...addr, country: e.target.value, provinceCode: "", cityCode: "", districtCode: "", villageCode: "" })} />
        </Field>
        {isIndonesia && <Field label={tt("Province", "Provinsi")}>
          <Select value={addr.provinceCode || ""} options={regionOpts(provinces)}
            onChange={(e) => onChange({ ...addr, provinceCode: e.target.value, cityCode: "", districtCode: "", villageCode: "" })} />
        </Field>}
      </div>
      {isIndonesia && (
        <>
          <div style={{ height: 12 }} />
          <div className="ag-vw-three-column-grid">
            <Field label={tt("City / Regency", "Kota / Kabupaten")}>
              <Select value={addr.cityCode || ""} disabled={!addr.provinceCode} options={regionOpts(cities)}
                onChange={(e) => onChange({ ...addr, cityCode: e.target.value, districtCode: "", villageCode: "" })} />
            </Field>
            <Field label={tt("District", "Kecamatan")}>
              <Select value={addr.districtCode || ""} disabled={!addr.cityCode} options={regionOpts(districts)}
                onChange={(e) => onChange({ ...addr, districtCode: e.target.value, villageCode: "" })} />
            </Field>
            <Field label={tt("Village", "Kelurahan / Desa")}>
              <Select value={addr.villageCode || ""} disabled={!addr.districtCode} options={regionOpts(villages)}
                onChange={(e) => onChange({ ...addr, villageCode: e.target.value })} />
            </Field>
          </div>
        </>
      )}
      <VwMapPicker open={mapOpen} mapConfig={mapConfig} initialLat={addr.latitude} initialLng={addr.longitude}
        onClose={() => setMapOpen(false)}
        onConfirm={(la, ln) => { onChange({ ...addr, latitude: la, longitude: ln }); setMapOpen(false); }} />
    </VwCard>
  );
}

/* Thin upload progress indicator (percent from XHR upload.onprogress). */
function VwUploadProgress({ progress, compact }) {
  const C = useC();
  const tt = useTT();
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const label = pct >= 100 ? tt("Saving…", "Menyimpan…") : `${pct}%`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: compact ? 6 : 8, minWidth: compact ? 72 : 110 }} title={label}>
      <span style={{ position: "relative", display: "block", width: compact ? 48 : 72, height: 6, borderRadius: 999, background: C.borderSoft, overflow: "hidden" }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: C.ocean, transition: "width 120ms linear" }} />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{label}</span>
    </span>
  );
}

/* ---------- company document uploader (vendor-level, legacy file rules) ---------- */
function VwDocSlot({ slot, docs, onChanged }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const inputRef = React.useRef(null);
  const existing = docs.find((d) => (d.documentType || "").toLowerCase() === slot.type);
  const rule = VW_FILE_RULES[slot.type];

  const upload = async (file) => {
    if (!file) return;
    const bad = VwCheckFile(file, slot.type);
    if (bad) {
      toast.push({ tone: "error", title: tt("File not allowed", "File tidak diizinkan"), description: bad });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      await VwApiUploadDoc(file, slot.type, null, setProgress);
      await onChanged();
      toast.push({ title: tt("Uploaded", "Terunggah"), description: file.name });
    }
    catch (e) { toast.push({ tone: "error", title: tt("Upload failed", "Gagal unggah"), description: e.message }); }
    finally { setBusy(false); setProgress(null); if (inputRef.current) inputRef.current.value = ""; }
  };
  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try { await VwApiDeleteDoc(existing.id); await onChanged(); }
    catch (e) { toast.push({ tone: "error", title: tt("Delete failed", "Gagal hapus"), description: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", padding: "10px 12px", border: `1px solid ${C.borderSoft}`, borderRadius: RADIUS.md, marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <Icon name={existing ? "file-check" : "file"} size={18} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {lang === "id" ? slot.id : slot.en}
            {slot.required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
          </div>
          <div style={{ fontSize: 11.5, color: C.textSubtle }}>
            {rule && `${rule.accept.join(", ")} · ${rule.maxMB < 1 ? Math.round(rule.maxMB * 1024) + "KB" : rule.maxMB + "MB"} max`}
          </div>
          {existing && <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>{existing.fileName}</div>
            {existing.isPlaceholder && <Badge tone="warning">{tt("Placeholder · replace", "Placeholder · wajib diganti")}</Badge>}
          </div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {progress != null ? <VwUploadProgress progress={progress} /> : (busy && <Spinner size={16} />)}
        {existing && !busy && <IconButton size="sm" name="search" variant="secondary" title={tt("View document", "Lihat dokumen")} onClick={() => VwOpenDoc(existing.id, existing.fileName)} style={{ color: C.info, borderColor: C.infoBg, backgroundColor: C.scheme === "dark" ? "rgba(125,211,252,0.12)" : "#eef8ff" }} />}
        {existing && !busy && <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove document", "Hapus dokumen")} onClick={remove} style={{ color: C.danger, borderColor: C.dangerBg, backgroundColor: C.scheme === "dark" ? "rgba(239,68,68,0.14)" : "#fff2f1" }} />}
        <input ref={inputRef} type="file" accept={rule ? rule.accept.join(",") : undefined} style={{ display: "none" }} onChange={(e) => upload(e.target.files && e.target.files[0])} />
        <IconButton size="sm" name={existing ? "refresh-cw" : "upload"} variant="secondary" title={existing ? tt("Replace file", "Ganti file") : tt("Upload file", "Unggah file")} onClick={() => !busy && inputRef.current && inputRef.current.click()} style={{ color: C.ocean, borderColor: C.brandBg, backgroundColor: C.brandBg, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }} />
      </div>
    </div>
  );
}

/* ---------- compact per-row document control (keyed by docType + natural ownerKey) ---------- */
function VwRowDoc({ docType, ownerKey, docs, onChanged }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const inputRef = React.useRef(null);
  const key = String(ownerKey || "").trim();
  const existing = key ? docs.find((d) => (d.documentType || "").toLowerCase() === docType && (d.ownerKey || "") === key) : null;
  const rule = VW_FILE_RULES[docType];

  if (!key) {
    return <span style={{ fontSize: 11.5, color: C.textSubtle }}>{tt("save row first", "simpan baris dulu")}</span>;
  }

  const upload = async (file) => {
    if (!file) return;
    const bad = VwCheckFile(file, docType);
    if (bad) {
      toast.push({ tone: "error", title: tt("File not allowed", "File tidak diizinkan"), description: bad });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      await VwApiUploadDoc(file, docType, key, setProgress);
      await onChanged();
      toast.push({ title: tt("Uploaded", "Terunggah"), description: file.name });
    }
    catch (e) { toast.push({ tone: "error", title: tt("Upload failed", "Gagal unggah"), description: e.message }); }
    finally { setBusy(false); setProgress(null); if (inputRef.current) inputRef.current.value = ""; }
  };
  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try { await VwApiDeleteDoc(existing.id); await onChanged(); }
    catch (e) { toast.push({ tone: "error", title: tt("Delete failed", "Gagal hapus"), description: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {progress != null ? <VwUploadProgress progress={progress} compact /> : (busy && <Spinner size={14} />)}
      {existing && !busy && <IconButton name="search" variant="secondary" title={tt("View document", "Lihat dokumen")} onClick={() => VwOpenDoc(existing.id, existing.fileName)} style={{ color: C.info, borderColor: C.infoBg, backgroundColor: C.scheme === "dark" ? "rgba(125,211,252,0.12)" : "#eef8ff" }} />}
      {existing && !busy && <IconButton name="trash-2" variant="secondary" title={tt("Remove document", "Hapus dokumen")} onClick={remove} style={{ color: C.danger, borderColor: C.dangerBg, backgroundColor: C.scheme === "dark" ? "rgba(239,68,68,0.14)" : "#fff2f1" }} />}
      <input ref={inputRef} type="file" accept={rule ? rule.accept.join(",") : undefined} style={{ display: "none" }} onChange={(e) => upload(e.target.files && e.target.files[0])} />
      <IconButton name={existing ? "refresh-cw" : "paperclip"} variant="secondary" title={existing ? tt("Replace file", "Ganti file") : tt("Attach file", "Lampirkan file")} onClick={() => !busy && inputRef.current && inputRef.current.click()} style={{ color: C.ocean, borderColor: C.brandBg, backgroundColor: C.brandBg, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }} />
    </span>
  );
}

/* ---------- small editable list helper ----------
   Optional rowDoc(row) -> { docType, ownerKey } enables a per-row document attach/view/remove. */
function VwSectionTitle({ children }) {
  const C = useC();
  return <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 10px" }}>{children}</div>;
}

/* A titled section card — the wizard is built from a stack of these. Title uses the same
   treatment as VwSectionTitle (the "DOCUMENTS" style). */
function VwCard({ title, children, tint, style }) {
  const C = useC();
  return (
    <Card style={{ padding: 18, marginBottom: 14, ...(tint ? { backgroundColor: tint } : {}), ...style }}>
      {title && <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>{title}</div>}
      {children}
    </Card>
  );
}

/* ---------- per-step validation (legacy wizard.js leaveStep rules) ---------- */

/* Parse a commodity-subclassification-kbli master row into a DNF rule (array of AND-groups).
   Tolerant of both shapes: new one-record-per-sub with payload.groups, and legacy pair rows. */
function VwParseKbliRulePayload(payloadJson) {
  if (!payloadJson) return null;
  try {
    const p = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
    const groups = p.groups || p.Groups;
    if (!Array.isArray(groups)) return null;
    return groups
      .map((g) => (Array.isArray(g) ? g : [g]).map((x) => String(x || "").trim()).filter(Boolean))
      .filter((g) => g.length);
  } catch (e) { return null; }
}

function VwKbliRulePreview(groups, andWord, orWord) {
  if (!groups || !groups.length) return "";
  const parts = groups.map((g) => (g.length > 1 ? `(${g.join(` ${andWord} `)})` : g[0]));
  return parts.join(` ${orWord} `);
}

function VwKbliRuleSatisfied(groups, vendorKbliCodes) {
  if (!groups || !groups.length) return true;
  const set = new Set(vendorKbliCodes || []);
  return groups.some((g) => g.every((k) => set.has(k)));
}

function VwStepErrors(stepKey, ctx) {
  const { form, docs, tt, kbliReqBySub, derivedSpecialReqs } = ctx;
  const errs = [];
  // Migration placeholders are intentionally visible in the profile, but never satisfy a legal
  // requirement. The vendor must replace them with genuine files before submission.
  const hasDoc = (t) => docs.some((d) => !d.isPlaceholder && (d.documentType || "").toLowerCase() === t && !(d.ownerKey || "").trim());

  if (stepKey === "agreement") {
    if (!form.isBiodataTrue || !form.isAgreeSubmit) errs.push(tt("Both declaration checkboxes must be ticked.", "Kedua pernyataan harus dicentang."));
    if (!hasDoc("pakta-integritas")) errs.push(tt("Pakta Integritas file is required.", "File Pakta Integritas wajib diunggah."));
  }

  if (stepKey === "biodata") {
    if (!String(form.name || "").trim()) errs.push(tt("Vendor Name is required.", "Nama vendor wajib diisi."));
    if (!String(form.office.country || "").trim()) errs.push(tt("Office country is required.", "Negara alamat kantor wajib dipilih."));
    const addrs = [
      [form.office, tt("Office address", "Alamat kantor"), true],
      [form.warehouse, tt("Warehouse address", "Alamat gudang"), false],
      [form.workshop, tt("Workshop address", "Alamat workshop"), false],
    ];
    addrs.forEach(([a, label, alwaysCountry]) => {
      if (!alwaysCountry && vwAddressInUse(a) && !String(a.country || "").trim()) {
        errs.push(`${label}: ${tt("country is required.", "negara wajib dipilih.")}`);
      }
      if (String(a.address || "").trim()) {
        if (a.latitude == null || a.longitude == null) errs.push(`${label}: ${tt("pick the location on the map.", "pilih lokasi di peta.")}`);
      }
    });
    if (form.subClassifications.length === 0) errs.push(tt("Add at least one Commodity.", "Tambahkan minimal 1 Commodity."));
    form.brands.forEach((b) => {
      const name = String(b.brandName || "").trim();
      if (!name) {
        errs.push(tt("Brand Name is required.", "Nama merek wajib diisi."));
        return;
      }
      if (!String(b.distributorTypeCode || "").trim()) {
        errs.push(tt(`Brand ${name}: Distributor Type is required.`,
          `Brand ${name}: Tipe Distributor wajib diisi.`));
      }
    });
  }

  if (stepKey === "umum") {
    if (vwIsIndonesiaCountry(form.office && form.office.country)) {
      if (!/^\d{16}$/.test(String(form.npwpNo || "").trim())) errs.push(tt("NPWP No. must be exactly 16 digits.", "NPWP harus tepat 16 digit angka."));
      if (!hasDoc("npwp")) errs.push(tt("NPWP file is required.", "File NPWP wajib diunggah."));
    }
    if (!String(form.nibNo || "").trim()) errs.push(tt("NIB No. is required.", "No. NIB wajib diisi."));
    if (!hasDoc("nib")) errs.push(tt("NIB file is required.", "File NIB wajib diunggah."));
    if (!String(form.aktaPendirianNo || "").trim()) errs.push(tt("Akta Pendirian No. is required.", "No. Akta Pendirian wajib diisi."));
    if (!form.aktaPendirianDate) errs.push(tt("Akta Pendirian date is required.", "Tanggal Akta Pendirian wajib diisi."));
    if (!hasDoc("akta-pendirian")) errs.push(tt("Akta Pendirian file is required.", "File Akta Pendirian wajib diunggah."));
    // Akta Perubahan / Penyesuaian: optional, but no + date + file must be filled together.
    const trio = (no, date, docType, label) => {
      const any = String(no || "").trim() || date || hasDoc(docType);
      if (any) {
        if (!String(no || "").trim()) errs.push(`${label}: ${tt("number is required.", "nomor wajib diisi.")}`);
        if (!date) errs.push(`${label}: ${tt("date is required.", "tanggal wajib diisi.")}`);
        if (!hasDoc(docType)) errs.push(`${label}: ${tt("file is required.", "file wajib diunggah.")}`);
      }
    };
    trio(form.aktaPerubahanNo, form.aktaPerubahanDate, "akta-perubahan", "Akta Perubahan");
    trio(form.aktaPenyesuaianNo, form.aktaPenyesuaianDate, "akta-penyesuaian", "Akta Penyesuaian");
    if (!String(form.sppkpNo || "").trim()) errs.push(tt("SPPKP No. is required.", "No. SPPKP wajib diisi."));
    if (!hasDoc("sppkp")) errs.push(tt("SPPKP file is required.", "File SPPKP wajib diunggah."));
    // DNF rule: groups are OR'd; codes inside a group are AND'd.
    const vendorCodes = form.kblis.map((k) => k.kbliCode);
    form.subClassifications.forEach((s) => {
      const groups = kbliReqBySub[s.subClassificationCode] || [];
      if (!groups.length) return;
      if (!VwKbliRuleSatisfied(groups, vendorCodes)) {
        const preview = VwKbliRulePreview(groups, "AND", "OR");
        errs.push(tt(`Commodity ${s.subClassificationCode} needs: ${preview}.`,
          `Commodity ${s.subClassificationCode} butuh: ${preview}.`));
      }
    });
    const hasKbliDoc = (code) => docs.some((d) => !d.isPlaceholder && (d.documentType || "").toLowerCase() === "kbli" && (d.ownerKey || "") === code);
    form.kblis.forEach((k) => {
      if (!vwKbliNeedsDocument(k.kbliTypeCode)) return;
      if (!hasKbliDoc(k.kbliCode)) {
        errs.push(tt(`KBLI ${k.kbliCode}: document is required for non-low risk.`,
          `KBLI ${k.kbliCode}: dokumen wajib untuk klasifikasi resiko selain Rendah.`));
      }
    });
  }

  if (stepKey === "khusus") {
    (derivedSpecialReqs || []).forEach((r) => {
      const entry = form.specialRequirements.find((x) => x.specialReqCode === r.code);
      if (!entry || !String(entry.number || "").trim()) {
        errs.push(`${r.name || r.code}: ${tt("number is required.", "nomor wajib diisi.")}`);
      }
    });
  }

  if (stepKey === "portfolio") {
    // Contract period (start & end) is mandatory on every vendor-entered portfolio. Without this
    // the wizard could carry an empty-period row (e.g. legacy data) into Submit, where the backend
    // rejects the blank date with a raw 400. Officer-entered rows are read-only and excluded.
    (form.portfolios || []).forEach((p) => {
      if (VwIsOfficerPortfolio(p)) return;
      const client = String(p.client || "").trim() || tt("(unnamed)", "(tanpa nama)");
      if (!p.contractStartDate || !p.contractEndDate) {
        errs.push(tt(`Portfolio ${client}: contract period (start and end) is required.`,
          `Portofolio ${client}: periode kontrak (mulai & akhir) wajib diisi.`));
      }
    });
  }

  return errs;
}

/* ============================ MAIN WIZARD ============================ */
function VendorProfileWizard({ initialProfile, onCancel, onSaved }) {
  const C = useC();
  const tt = useTT();
  const { lang } = useI18n();
  const toast = useToast();

  const [step, setStep] = React.useState(0);
  const [maxStep, setMaxStep] = React.useState(0);
  const bodyRef = React.useRef(null);
  const [stepRailScrolled, setStepRailScrolled] = React.useState(false);
  // Scroll only the popup's form area back to the top whenever the step changes.
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setStepRailScrolled(false);
  }, [step]);
  const [saving, setSaving] = React.useState(false);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [stepErrs, setStepErrs] = React.useState([]);
  const [mapConfig, setMapConfig] = React.useState({ subscriptionKey: "", country: "IDN" });
  const [docs, setDocs] = React.useState([]);
  const [me, setMe] = React.useState(null);
  const [countries, setCountries] = React.useState([]);
  const [kbliReqBySub, setKbliReqBySub] = React.useState({});
  const [srBySub, setSrBySub] = React.useState({});
  const [srNames, setSrNames] = React.useState({});
  const [form, setForm] = React.useState(() => VwProfileToForm(initialProfile));

  React.useEffect(() => {
    VwApiMapConfig().then(setMapConfig);
    VwApiVendorMe().then(setMe).catch(() => setMe(null));
    VwApiMasterSet("country", { take: 500 }).then(setCountries);
    // KBLI requirement per commodity as DNF groups. Tolerant of new (payload.groups) and legacy (sub|kbli) rows.
    VwApiMasterSet("commodity-subclassification-kbli", { take: 10000 }).then((rows) => {
      const map = {};
      const ruleDefined = new Set();
      rows.forEach((r) => {
        const parsed = VwParseKbliRulePayload(r.payloadJson);
        if (parsed) {
          const subId = (() => {
            try {
              const p = typeof r.payloadJson === "string" ? JSON.parse(r.payloadJson) : r.payloadJson;
              return String((p && (p.SubClassificationId || p.subClassificationId)) || r.code || "").trim();
            } catch (e) { return String(r.code || "").trim(); }
          })();
          if (!subId) return;
          map[subId] = parsed;
          ruleDefined.add(subId);
          return;
        }
        const parts = String(r.code || "").split("|");
        if (parts.length === 2) {
          const subId = parts[0];
          if (ruleDefined.has(subId)) return;
          if (!map[subId]) map[subId] = [];
          const kbli = parts[1];
          if (kbli && !map[subId].some((g) => g.length === 1 && g[0] === kbli)) map[subId].push([kbli]);
        }
      });
      setKbliReqBySub(map);
    });
    VwApiMasterSet("commodity-subclassification-special-requirement", { take: 10000 }).then((rows) => {
      const map = {};
      rows.forEach((r) => {
        const parts = String(r.code || "").split("|");
        if (parts.length === 2) (map[parts[0]] = map[parts[0]] || []).push(parts[1]);
      });
      setSrBySub(map);
    });
    VwApiMasterSet("special-requirement", { take: 1000 }).then((rows) => {
      const names = {};
      rows.forEach((r) => { names[r.code] = r.name; });
      setSrNames(names);
    });
  }, []);
  const reloadDocs = React.useCallback(() => VwApiListDocs().then((d) => setDocs(Array.isArray(d) ? d : [])).catch(() => setDocs([])), []);
  React.useEffect(() => { reloadDocs(); }, [reloadDocs]);
  // Take the upload rules from the server that enforces them, so a hint can never promise more than
  // the API accepts. Re-render once they land so the hints show the authoritative numbers.
  const [, setRulesRevision] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    VwHydrateFileRules().then(() => { if (!cancelled) setRulesRevision((n) => n + 1); });
    return () => { cancelled = true; };
  }, []);

  // Keep a ref so commit/persist always see the latest form (avoids stale-closure overwrites
  // when two child-row saves race, which orphaned portfolio docs via backend cleanup).
  const formRef = React.useRef(form);
  formRef.current = form;
  const [childModalOpen, setChildModalOpen] = React.useState(false);

  const set = (k, v) => setForm((f) => {
    // Free-text scalars → UPPERCASE. Skip dates / nested objects / booleans / email (read-only).
    if (typeof v === "string" && !/email/i.test(k) && !/Date$/i.test(k)) {
      return { ...f, [k]: vwAutoUpper(v) };
    }
    return { ...f, [k]: v };
  });
  const F = (k) => (form[k] == null ? "" : form[k]);

  /* special requirements derived from the commodities selected in Bio Data (legacy LoadViewSpecialReq) */
  const derivedSpecialReqs = React.useMemo(() => {
    const codes = new Set();
    form.subClassifications.forEach((s) => (srBySub[s.subClassificationCode] || []).forEach((c) => codes.add(c)));
    form.specialRequirements.forEach((r) => codes.add(r.specialReqCode)); // keep existing rows visible
    return Array.from(codes).sort().map((code) => ({ code, name: srNames[code] || code }));
  }, [form.subClassifications, form.specialRequirements, srBySub, srNames]);

  const valCtx = { form, docs, tt, kbliReqBySub, derivedSpecialReqs };

  const persist = async (submit) => {
    if (childModalOpen) return false;
    setErr(""); setSaving(true);
    try {
      const result = await VwApiSaveProfile(VwFormToPayload(formRef.current, submit));
      await onSaved(result, submit);
      return true;
    } catch (e) {
      const serverErrors = e.payload && Array.isArray(e.payload.errors) ? e.payload.errors.filter(Boolean) : [];
      const message = e.status === 409
        ? tt("This profile can no longer be edited (already under review or approved).", "Profil ini tidak dapat diubah lagi (sudah dalam review atau disetujui).")
        : (serverErrors.length ? serverErrors.join(" ") : (e.message || tt("Save failed.", "Gagal menyimpan.")));
      setErr(message);
      toast.push({ tone: "error", title: tt("Save failed", "Gagal menyimpan"), description: message });
      return false;
    } finally { setSaving(false); }
  };

  // Table CRUD (brands, commodity, KBLI, certificates, portfolio) persists to the DB immediately —
  // no need to wait for "Save as Draft" or "Continue".
  const autoSave = React.useCallback(async (nextForm) => {
    try { await VwApiSaveProfile(VwFormToPayload(nextForm, false)); }
    catch (e) { toast.push({ tone: "error", title: tt("Auto-save failed", "Gagal menyimpan otomatis"), description: e.message || "" }); }
  }, [toast, tt]);
  const commit = React.useCallback((nextOrFn) => {
    const prev = formRef.current;
    const next = typeof nextOrFn === "function" ? nextOrFn(prev) : nextOrFn;
    formRef.current = next;
    setForm(next);
    autoSave(next);
  }, [autoSave]);

  const goNext = async () => {
    const errors = VwStepErrors(VW_PROFILE_STEPS[step].key, valCtx);
    setStepErrs(errors);
    if (errors.length) {
      toast.push({
        tone: "error",
        title: tt("Please complete this step", "Lengkapi langkah ini"),
        description: errors.join(" "),
      });
      return;
    }
    // Every Continue auto-saves the current data as a draft (same effect as "Save as Draft", but
    // without leaving the wizard) and then advances. A 409 means the profile is locked (under review/
    // approved) → block; any other transient failure is surfaced via a toast but does not stop progress
    // (the in-memory form is retried on the next Continue / Save as Draft / Submit).
    setErr(""); setSaving(true);
    let blocked = false;
    try {
      await VwApiSaveProfile(VwFormToPayload(formRef.current, false));
    } catch (e) {
      if (e.status === 409) {
        const message = tt("This profile can no longer be edited (already under review or approved).", "Profil ini tidak dapat diubah lagi (sudah dalam review atau disetujui).");
        setErr(message);
        toast.push({ tone: "error", title: tt("Unable to continue", "Tidak dapat melanjutkan"), description: message });
        blocked = true;
      } else {
        toast.push({ tone: "error", title: tt("Auto-save failed", "Gagal menyimpan otomatis"), description: e.message || "" });
      }
    } finally { setSaving(false); }
    if (blocked) return;
    const nxt = Math.min(VW_PROFILE_STEPS.length - 1, step + 1);
    setStep(nxt);
    setMaxStep((m) => Math.max(m, nxt));
  };

  const submitAll = () => {
    // Legacy confirm before VendorApprovalProcess (NextStatusId: StsSubmitted).
    for (let i = 0; i < VW_PROFILE_STEPS.length; i++) {
      const errors = VwStepErrors(VW_PROFILE_STEPS[i].key, valCtx);
      if (errors.length) {
        setStep(i);
        setStepErrs(errors);
        toast.push({
          tone: "error",
          title: tt("Please complete this step", "Lengkapi langkah ini"),
          description: errors.join(" "),
        });
        return;
      }
    }
    setStepErrs([]);
    setConfirmSubmit(true);
  };

  const confirmAndSubmit = async () => {
    const ok = await persist(true);
    if (ok) setConfirmSubmit(false);
  };

  const cur = VW_PROFILE_STEPS[step].key;
  const isLast = step === VW_PROFILE_STEPS.length - 1;

  const wizardNode = (
    <>
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(2,17,24,0.58)", backdropFilter: "blur(2px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vw-registration-wizard-title"
        style={{
          ...FONT, width: "90vw", maxWidth: "90vw", height: "auto", maxHeight: "100vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          backgroundColor: C.surface, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.xl, boxShadow: C.shadowLg,
          animation: "modalIn 0.16s ease",
        }}
      >
        <style>{VW_WIZARD_LAYOUT_CSS}</style>
        <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
          {stepRailScrolled && (
            <span title={lang === "id" ? VW_PROFILE_STEPS[step].id : VW_PROFILE_STEPS[step].en}
              style={{ width: 42, height: 42, borderRadius: RADIUS.md, background: C.brandBg, color: C.ocean, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={VW_PROFILE_STEPS[step].icon} size={20} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.ocean }}>
              {tt(`Step ${step + 1} of ${VW_PROFILE_STEPS.length}`, `Langkah ${step + 1} dari ${VW_PROFILE_STEPS.length}`)}
            </div>
            <h2 id="vw-registration-wizard-title" style={{ fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", margin: "3px 0 0" }}>
              {tt("Vendor registration wizard", "Wizard registrasi vendor")}
            </h2>
            <p style={{ fontSize: 12.5, color: C.textMuted, margin: "2px 0 0" }}>
              {tt("Complete every step, then submit for review.", "Lengkapi setiap langkah, lalu submit untuk direview.")}
            </p>
          </div>
          <button
            type="button"
            title={tt("Close", "Tutup")}
            aria-label={tt("Close registration wizard", "Tutup wizard registrasi")}
            disabled={saving || childModalOpen || confirmSubmit}
            onClick={onCancel}
            style={{
              ...FONT, width: 36, height: 36, borderRadius: RADIUS.md,
              border: `1px solid ${C.border}`, backgroundColor: C.surface,
              color: C.textMuted, cursor: saving || childModalOpen || confirmSubmit ? "not-allowed" : "pointer",
              opacity: saving || childModalOpen || confirmSubmit ? 0.5 : 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div ref={bodyRef} onScroll={(e) => setStepRailScrolled(e.currentTarget.scrollTop > 8)} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <nav aria-label={tt("Registration steps", "Langkah registrasi")} style={{ padding: "12px 20px", borderBottom: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${VW_PROFILE_STEPS.length}, minmax(148px, 1fr))`, gap: 8, minWidth: 780 }}>
            {VW_PROFILE_STEPS.map((s, i) => {
              const done = i < step, curStep = i === step, reachable = i <= maxStep;
              const borderColor = done ? C.success : curStep ? C.ocean : C.border;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!reachable}
                  aria-current={curStep ? "step" : undefined}
                  onClick={() => { if (reachable) { setStepErrs([]); setStep(i); } }}
                  style={{
                    ...FONT, minWidth: 0, height: 58, padding: "8px 10px",
                    display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                    border: `1px solid ${borderColor}`, borderRadius: RADIUS.md,
                    backgroundColor: curStep ? C.brandBg : C.surface,
                    boxShadow: curStep ? `0 5px 16px ${C.shadowColor || "rgba(1,59,82,0.12)"}` : "none",
                    cursor: reachable ? "pointer" : "default", opacity: reachable ? 1 : 0.5,
                  }}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: done ? C.successBg : curStep ? C.ocean : C.surfaceAlt,
                    color: done ? C.success : curStep ? "#fff" : C.textSubtle,
                  }}>
                    <Icon name={done ? "check" : s.icon} size={14} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: done ? C.success : curStep ? C.ocean : C.textSubtle }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, fontWeight: curStep ? 800 : 650, color: curStep ? C.text : C.textMuted }}>
                      {lang === "id" ? s.id : s.en}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div style={{ padding: "20px" }}>
          {cur === "agreement" && <VwStepAgreement form={form} set={set} docs={docs} reloadDocs={reloadDocs} />}
          {cur === "biodata" && (
            <VwStepBioData form={form} set={set} setForm={setForm} commit={commit} me={me} countries={countries}
              mapConfig={mapConfig} docs={docs} reloadDocs={reloadDocs} onModalOpenChange={setChildModalOpen} />
          )}
          {cur === "umum" && (
            <VwStepUmum form={form} set={set} setForm={setForm} commit={commit} docs={docs} reloadDocs={reloadDocs}
              kbliReqBySub={kbliReqBySub} onModalOpenChange={setChildModalOpen} />
          )}
          {cur === "khusus" && (
            <VwStepKhusus form={form} setForm={setForm} commit={commit} docs={docs} reloadDocs={reloadDocs}
              derivedSpecialReqs={derivedSpecialReqs} onModalOpenChange={setChildModalOpen} />
          )}
          {cur === "portfolio" && (
            <VwStepPortfolio form={form} setForm={setForm} commit={commit} docs={docs} reloadDocs={reloadDocs}
              onModalOpenChange={setChildModalOpen} />
          )}

          {stepErrs.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <Alert tone="error" title={tt("Please complete this step", "Lengkapi langkah ini")}
                description={stepErrs.join(" ")} />
            </div>
          )}
          {err && <div style={{ marginBottom: 14 }}><Alert tone="error" title={err} /></div>}
        </div>
        </div>

        <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 20px", borderTop: `1px solid ${C.borderSoft}`, backgroundColor: C.surfaceAlt, flexShrink: 0 }}>
          <Button variant="secondary" iconLeft="arrow-left" disabled={step === 0 || saving || childModalOpen} onClick={() => { setStepErrs([]); setStep((x) => Math.max(0, x - 1)); }}>{tt("Back", "Kembali")}</Button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="secondary" iconLeft="save" disabled={saving || childModalOpen} onClick={() => persist(false)}>{saving ? <Spinner size={15} /> : tt("Save as Draft", "Simpan sebagai Draf")}</Button>
            {isLast
              ? <Button iconLeft="send" disabled={saving || childModalOpen} onClick={submitAll}>{saving ? <Spinner size={15} color="#fff" /> : tt("Submit", "Submit")}</Button>
              : <Button iconRight="arrow-right" disabled={saving || childModalOpen} onClick={goNext}>{saving ? <Spinner size={15} color="#fff" /> : tt("Continue", "Lanjutkan")}</Button>}
          </div>
        </footer>
      </section>
    </div>
    <Modal open={confirmSubmit} onClose={() => { if (!saving) setConfirmSubmit(false); }} width={460} icon="send"
      title={tt("Submit for review?", "Ajukan untuk direview?")}
      subtitle={tt("Draft → Submitted", "Draf → Terkirim")}
      footer={<>
        <Button variant="secondary" disabled={saving} onClick={() => setConfirmSubmit(false)}>{tt("Not yet", "Belum")}</Button>
        <Button iconLeft="send" disabled={saving} onClick={confirmAndSubmit}>{saving ? <Spinner size={14} /> : tt("Yes, submit for review", "Ya, ajukan untuk direview")}</Button>
      </>}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 36, height: 36, borderRadius: RADIUS.md, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: C.brandBg, color: C.ocean }}><Icon name="send" size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
            {tt("Submit", "Ajukan")} <strong>{form.name || tt("this vendor profile", "profil vendor ini")}</strong>?
          </div>
          <div style={{ marginTop: 5, fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>
            {tt("We'll send your data and documents to the reviewer. You won't be able to edit until they ask for a revision or finish the review.",
              "Data dan dokumen Anda akan dikirim ke reviewer. Anda tidak dapat mengubahnya sampai mereka meminta revisi atau menyelesaikan review.")}
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
  return (typeof ReactDOM !== "undefined" && typeof document !== "undefined" && document.body)
    ? ReactDOM.createPortal(wizardNode, document.body)
    : wizardNode;
}

/* ---------- STEP 1: Agreement ---------- */
function VwStepAgreement({ form, set, docs, reloadDocs }) {
  const C = useC();
  const tt = useTT();
  return (
    <>
      <VwCard title={tt("Vendor Declaration Statement", "Pernyataan Vendor")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Checkbox checked={!!form.isBiodataTrue} onChange={(v) => set("isBiodataTrue", typeof v === "boolean" ? v : v.target.checked)}
            label={tt("All information provided in this Vendor Biodata is true, accurate, and complete.",
              "Seluruh informasi yang disampaikan dalam Biodata Vendor ini adalah benar, akurat dan lengkap.")} />
          <Checkbox checked={!!form.isAgreeSubmit} onChange={(v) => set("isAgreeSubmit", typeof v === "boolean" ? v : v.target.checked)}
            label={tt("Agree to complete this biodata and to submit all required documents in accordance with both the General Requirements and the Specific Requirements set by PT Saptaindra Sejati.",
              "Vendor bersedia untuk mengisi biodata ini dan melengkapi seluruh dokumen yang dipersyaratkan, baik yang termasuk dalam Persyaratan Umum maupun Persyaratan Khusus yang ditetapkan oleh PT Saptaindra Sejati.")} />
        </div>
      </VwCard>
      <VwCard title={tt("Document", "Dokumen")}>
        <div className="ag-vw-two-column-grid">
          <VwDocSlot slot={{ type: "pakta-integritas", en: "Pakta Integritas (Integrity Pact)", id: "Pakta Integritas", required: true }} docs={docs} onChanged={reloadDocs} />
          <VwDocSlot slot={{ type: "company-profile", en: "Company Profile", id: "Profil Perusahaan" }} docs={docs} onChanged={reloadDocs} />
        </div>
      </VwCard>
    </>
  );
}

/* Tri-state checkbox for the commodity tree: "on" (all), "some" (partial), "off". */
function VwTreeCheck({ state, onClick }) {
  const C = useC();
  const filled = state === "on" || state === "some";
  return (
    <span onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ width: 19, height: 19, borderRadius: 5, flexShrink: 0, cursor: "pointer", transition: "all 0.12s",
        border: `1.5px solid ${filled ? C.primary : C.border}`, backgroundColor: filled ? C.primary : C.inputBg,
        display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {state === "on" && <Icon name="check" size={12} color="#fff" strokeWidth={3} />}
      {state === "some" && <Icon name="minus" size={12} color="#fff" strokeWidth={3} />}
    </span>
  );
}

function VwMasterParentCode(record, payloadKey) {
  const direct = record && (record.parentCode || record.ParentCode);
  if (direct) return String(direct).trim();
  if (!record || !record.payloadJson) return "";
  try {
    const payload = typeof record.payloadJson === "string" ? JSON.parse(record.payloadJson) : record.payloadJson;
    const wanted = String(payloadKey || "").toLowerCase();
    const key = Object.keys(payload || {}).find((candidate) => candidate.toLowerCase() === wanted);
    return key && payload[key] != null ? String(payload[key]).trim() : "";
  } catch (e) {
    return "";
  }
}

/* ---------- Commodity picker (legacy VendorConnect treeview: Category ▸ Classification ▸ Sub) ----------
   Leaf (sub-classification) checkboxes drive the selection; branch checkboxes select/clear all their
   descendants and show an indeterminate state when only some are picked. The hierarchy is refreshed on
   every open so saved code-only rows can be resolved and stale tree caches cannot block reselection. */
function VwCommodityModal({ open, onClose, cats: catsProp, initial, onSave }) {
  const C = useC();
  const tt = useTT();
  const [cats, setCats] = React.useState(catsProp || []);
  const [loadingCats, setLoadingCats] = React.useState(!!open);
  const [clsByCat, setClsByCat] = React.useState({});
  const [subsByCls, setSubsByCls] = React.useState({});
  const [expanded, setExpanded] = React.useState({});
  const [sel, setSel] = React.useState({});

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCats(true);
    setClsByCat({});
    setSubsByCls({});
    setExpanded({});
    setSel({});

    Promise.all([
      catsProp && catsProp.length ? Promise.resolve(catsProp) : VwApiMasterSet("commodity-category", { take: 1000 }),
      VwApiMasterSet("commodity-classification", { take: 5000 }),
      VwApiMasterSet("commodity-subclassification", { take: 20000 }),
    ]).then(([catList, clsList, subList]) => {
      if (cancelled) return;
      const safeCats = catList || [];
      const safeCls = clsList || [];
      const safeSubs = subList || [];
      const nextClsByCat = {};
      const nextSubsByCls = {};
      const catMap = {};
      const clsMap = {};
      const subMap = {};

      safeCats.forEach((cat) => { catMap[cat.code] = cat; nextClsByCat[cat.code] = []; });
      safeCls.forEach((record) => {
        const cls = { ...record, parentCode: VwMasterParentCode(record, "CategoryId") };
        clsMap[cls.code] = cls;
        (nextClsByCat[cls.parentCode] = nextClsByCat[cls.parentCode] || []).push(cls);
        nextSubsByCls[cls.code] = [];
      });
      safeSubs.forEach((record) => {
        const sub = { ...record, parentCode: VwMasterParentCode(record, "ClassificationId") };
        subMap[sub.code] = sub;
        (nextSubsByCls[sub.parentCode] = nextSubsByCls[sub.parentCode] || []).push(sub);
      });

      const nextSel = {};
      const nextExpanded = {};
      (initial || []).forEach((row) => {
        const code = String(row.subClassificationCode || "").trim();
        if (!code) return;
        const sub = subMap[code];
        const clsCode = (sub && sub.parentCode) || row._clsCode || "";
        const cls = clsMap[clsCode];
        const catCode = (cls && cls.parentCode) || row._catCode || "";
        const cat = catMap[catCode];
        nextSel[code] = {
          code,
          name: (sub && sub.name) || row._label || code,
          clsCode,
          clsName: (cls && cls.name) || row._cls || "",
          catCode,
          catName: (cat && cat.name) || row._cat || "",
        };
        if (catCode) nextExpanded["c:" + catCode] = true;
        if (clsCode) nextExpanded["s:" + clsCode] = true;
      });

      setCats(safeCats);
      setClsByCat(nextClsByCat);
      setSubsByCls(nextSubsByCls);
      setSel(nextSel);
      setExpanded(nextExpanded);
    }).finally(() => {
      if (!cancelled) setLoadingCats(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  const loadCls = (catCode) => clsByCat[catCode]
    ? Promise.resolve(clsByCat[catCode])
    : VwApiMasterSet("commodity-classification", { parent: catCode, take: 2000 }).then((rows) => { setClsByCat((m) => ({ ...m, [catCode]: rows })); return rows; });
  const loadSubs = (clsCode) => subsByCls[clsCode]
    ? Promise.resolve(subsByCls[clsCode])
    : VwApiMasterSet("commodity-subclassification", { parent: clsCode, take: 2000 }).then((rows) => { setSubsByCls((m) => ({ ...m, [clsCode]: rows })); return rows; });

  const toggleExpand = (key, loader) => {
    const willOpen = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: willOpen }));
    if (willOpen && loader) loader();
  };

  const toggleSub = (cat, cls, sub) => setSel((prev) => {
    const next = { ...prev };
    if (next[sub.code]) delete next[sub.code];
    else next[sub.code] = { code: sub.code, name: sub.name, clsCode: cls.code, clsName: cls.name, catCode: cat.code, catName: cat.name };
    return next;
  });

  const toggleCls = (cat, cls) => loadSubs(cls.code).then((subs) => setSel((prev) => {
    const next = { ...prev };
    const allSel = subs.length > 0 && subs.every((s) => next[s.code]);
    if (allSel) subs.forEach((s) => delete next[s.code]);
    else subs.forEach((s) => { next[s.code] = { code: s.code, name: s.name, clsCode: cls.code, clsName: cls.name, catCode: cat.code, catName: cat.name }; });
    return next;
  }));

  const toggleCat = (cat) => loadCls(cat.code).then((clsList) =>
    Promise.all(clsList.map((c) => loadSubs(c.code).then((subs) => ({ c, subs })))).then((pairs) => setSel((prev) => {
      const next = { ...prev };
      const all = pairs.flatMap((p) => p.subs.map((s) => ({ s, cls: p.c })));
      const allSel = all.length > 0 && all.every((x) => next[x.s.code]);
      if (allSel) all.forEach((x) => delete next[x.s.code]);
      else all.forEach((x) => { next[x.s.code] = { code: x.s.code, name: x.s.name, clsCode: x.cls.code, clsName: x.cls.name, catCode: cat.code, catName: cat.name }; });
      return next;
    })));

  const clsState = (cls) => {
    const subs = subsByCls[cls.code];
    const chosen = Object.values(sel).filter((v) => v.clsCode === cls.code).length;
    if (!chosen) return "off";
    if (subs && chosen >= subs.length) return "on";
    return "some";
  };
  const catState = (cat) => {
    const chosen = Object.values(sel).filter((v) => v.catCode === cat.code).length;
    if (!chosen) return "off";
    const clsList = clsByCat[cat.code];
    if (clsList && clsList.length && clsList.every((c) => clsState(c) === "on")) return "on";
    return "some";
  };

  const row = (depth, key, hasChildren, expandedNow, onExpand, checkState, onCheck, label, bold) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", paddingLeft: depth * 26 }}>
      <span onClick={onExpand} style={{ width: 18, display: "inline-flex", justifyContent: "center", cursor: hasChildren ? "pointer" : "default", color: C.textMuted }}>
        {hasChildren && <Icon name={expandedNow ? "chevron-down" : "chevron-right"} size={15} />}
      </span>
      <VwTreeCheck state={checkState} onClick={onCheck} />
      <span onClick={hasChildren ? onExpand : onCheck} style={{ fontSize: 13.5, color: C.text, fontWeight: bold ? 700 : 500, cursor: "pointer" }}>{label}</span>
    </div>
  );

  const selCount = Object.keys(sel).length;

  return (
    <Modal open={open} onClose={onClose} width={720} icon="layers"
      title="Commodity" subtitle={tt("Please select commodity", "Silakan pilih commodity")}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: 12.5, color: C.textMuted }}>{selCount} {tt("selected", "dipilih")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>{tt("Cancel", "Batal")}</Button>
            <Button iconLeft="check" onClick={() => { onSave(Object.values(sel).map((v) => ({ subClassificationCode: v.code, _label: v.name, _cls: v.clsName, _cat: v.catName, _clsCode: v.clsCode, _catCode: v.catCode }))); onClose(); }}>{tt("Save", "Simpan")}</Button>
          </div>
        </div>
      }>
      <div style={{ maxHeight: "58vh", overflowY: "auto", minHeight: 120 }}>
        {loadingCats && <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}><Spinner size={20} /></div>}
        {!loadingCats && cats.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px", fontSize: 13, color: C.textMuted }}>
            {tt("No commodities available.", "Data commodity tidak tersedia.")}
          </div>
        )}
        {!loadingCats && cats.map((cat) => (
          <div key={cat.code}>
            {row(0, "c:" + cat.code, true, !!expanded["c:" + cat.code],
              () => toggleExpand("c:" + cat.code, () => loadCls(cat.code)), catState(cat), () => toggleCat(cat), cat.name, true)}
            {expanded["c:" + cat.code] && (clsByCat[cat.code] || []).map((cls) => (
              <div key={cls.code}>
                {row(1, "s:" + cls.code, true, !!expanded["s:" + cls.code],
                  () => toggleExpand("s:" + cls.code, () => loadSubs(cls.code)), clsState(cls), () => toggleCls(cat, cls), cls.name, false)}
                {expanded["s:" + cls.code] && (subsByCls[cls.code] || []).map((sub) => (
                  row(2, "u:" + sub.code, false, false, null, sel[sub.code] ? "on" : "off", () => toggleSub(cat, cls, sub), `${sub.code} - ${sub.name}`, false)
                ))}
                {expanded["s:" + cls.code] && !subsByCls[cls.code] && <div style={{ paddingLeft: 78, padding: "6px 0 6px 78px" }}><Spinner size={14} /></div>}
              </div>
            ))}
            {expanded["c:" + cat.code] && !clsByCat[cat.code] && <div style={{ paddingLeft: 44, padding: "6px 0 6px 44px" }}><Spinner size={14} /></div>}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- Brand add/edit modal (legacy VendorConnect: popup form → table row) ----------
   The document is keyed by brand name (docType "brand", ownerKey = brandName), uploaded to Blob
   as soon as it is chosen, so it survives editing the row. */
function VwBrandModal({ open, onClose, editing, brands, distTypes, docs, onSave, onDocChanged }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [dist, setDist] = React.useState("");
  const [expire, setExpire] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const inputRef = React.useRef(null);
  // Track a doc uploaded during an ADD session so it can be rolled back if the user cancels.
  const savedRef = React.useRef(false);
  const sessionDocIdRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const r = editing && editing.row;
    if (r) {
      setName(r.brandName || "");
      setDist(r.distributorTypeCode || "");
      setExpire(r.expireDate || "");
    } else {
      setName(""); setDist(""); setExpire("");
    }
    setBusy(false);
    setProgress(null);
    savedRef.current = false;
    sessionDocIdRef.current = null;
  }, [open]);

  const brandName = name.trim();
  const doc = brandName ? docs.find((d) => (d.documentType || "").toLowerCase() === "brand" && (d.ownerKey || "") === brandName) : null;
  const rule = VW_FILE_RULES.brand;
  const brandOpts = [{ value: "", label: tt("Select brand …", "Pilih merek …") },
    ...brands.map((r) => ({ value: r.name, label: r.name }))];
  const distOpts = [{ value: "", label: tt("Select distributor type …", "Pilih tipe distributor …") }, ...distTypes.map((r) => ({ value: r.code, label: r.name }))];

  const upload = async (file) => {
    if (!file) return;
    if (!brandName) { toast.push({ tone: "error", title: tt("Select a brand first.", "Pilih merek terlebih dahulu.") }); if (inputRef.current) inputRef.current.value = ""; return; }
    const bad = VwCheckFile(file, "brand");
    if (bad) { toast.push({ tone: "error", title: tt("File not allowed", "File tidak diizinkan"), description: bad }); if (inputRef.current) inputRef.current.value = ""; return; }
    setBusy(true);
    setProgress(0);
    try {
      const created = await VwApiUploadDoc(file, "brand", brandName, setProgress);
      if (!editing && created && created.id != null) sessionDocIdRef.current = created.id;
      await onDocChanged();
      toast.push({ title: tt("Uploaded", "Terunggah"), description: file.name });
    }
    catch (e) { toast.push({ tone: "error", title: tt("Upload failed", "Gagal unggah"), description: e.message }); }
    finally { setBusy(false); setProgress(null); if (inputRef.current) inputRef.current.value = ""; }
  };
  const removeDoc = async () => {
    if (!doc) return;
    setBusy(true);
    try { await VwApiDeleteDoc(doc.id); if (sessionDocIdRef.current === doc.id) sessionDocIdRef.current = null; await onDocChanged(); }
    catch (e) { toast.push({ tone: "error", title: tt("Delete failed", "Gagal hapus"), description: e.message }); }
    finally { setBusy(false); }
  };
  const save = () => {
    const distCode = dist.trim();
    if (!brandName) { toast.push({ tone: "error", title: tt("Brand Name is required.", "Nama merek wajib diisi.") }); return; }
    if (!distCode) { toast.push({ tone: "error", title: tt("Distributor Type is required.", "Tipe Distributor wajib diisi.") }); return; }
    savedRef.current = true;
    onSave({ brandName, distributorTypeCode: distCode, isOther: false, expireDate: expire || null }, editing ? editing.index : null);
    onClose();
  };
  // Cancel/close: if a document was uploaded in this Add session and the row was not saved, roll back its blob.
  const handleClose = async () => {
    if (!savedRef.current && !editing && sessionDocIdRef.current != null) {
      const id = sessionDocIdRef.current;
      sessionDocIdRef.current = null;
      try { await VwApiDeleteDoc(id); await onDocChanged(); } catch (e) { /* best effort */ }
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} width={560} icon="tag" title="Brand" subtitle={tt("Add / Edit Vendor Brand", "Tambah / Ubah Merek Vendor")}
      footer={<><Button variant="secondary" onClick={handleClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="save" onClick={save}>{tt("Save", "Simpan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Brand Name", "Nama Merek")} required><Select value={name} options={brandOpts} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={tt("Distributor Type", "Tipe Distributor")} required><Select value={dist} options={distOpts} onChange={(e) => setDist(e.target.value)} /></Field>
        <Field label={tt("Expire Date", "Tanggal Kedaluwarsa")}><TextInput type="date" value={expire} onChange={(e) => setExpire(e.target.value)} /></Field>
        <Field label={tt("Document", "Dokumen")}>
          {doc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={() => VwOpenDoc(doc.id, doc.fileName)} style={{ ...FONT, background: "none", border: "none", padding: 0, cursor: "pointer", color: C.ocean, fontWeight: 700, fontSize: 13, textDecoration: "underline", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{doc.fileName}</button>
              <IconButton size="sm" name="search" variant="secondary" title={tt("View", "Lihat")} onClick={() => VwOpenDoc(doc.id, doc.fileName)} />
              <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={removeDoc} />
              {progress != null ? <VwUploadProgress progress={progress} compact /> : (busy && <Spinner size={14} />)}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input ref={inputRef} type="file" accept={rule ? rule.accept.join(",") : undefined} style={{ display: "none" }} onChange={(e) => upload(e.target.files && e.target.files[0])} />
              <Button size="sm" variant="secondary" iconLeft="upload" disabled={busy || !brandName} onClick={() => inputRef.current && inputRef.current.click()}>{tt("Choose file", "Pilih file")}</Button>
              {progress != null ? <VwUploadProgress progress={progress} compact /> : (busy && <Spinner size={14} />)}
              <span style={{ fontSize: 11.5, color: C.textSubtle }}>{!brandName ? tt("select a brand first", "pilih merek dulu") : (rule && `${rule.accept.join(", ")} · ${rule.maxMB < 1 ? Math.round(rule.maxMB * 1024) + "KB" : rule.maxMB + "MB"} max`)}</span>
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* Shared document control for the row modals (KBLI / Certificate / Portfolio). Uploads to Blob as
   soon as a file is chosen; on cancel of an ADD it rolls the blob back.
   opts.onUploaded(ownerKey) — optional hook so callers can persist the owning child row
   immediately (prevents backend orphan-cleanup from deleting a just-uploaded doc). */
function useVwSessionDoc(open, editing, docType, ownerKey, docs, onDocChanged, opts) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const inputRef = React.useRef(null);
  const savedRef = React.useRef(false);
  const sessionDocIdRef = React.useRef(null);
  const onUploaded = opts && opts.onUploaded;
  React.useEffect(() => { if (open) { savedRef.current = false; sessionDocIdRef.current = null; setBusy(false); setProgress(null); } }, [open]);

  const key = String(ownerKey || "").trim();
  const doc = key ? docs.find((d) => (d.documentType || "").toLowerCase() === docType && (d.ownerKey || "") === key) : null;
  const rule = VW_FILE_RULES[docType];

  const upload = async (file) => {
    if (!file) return;
    if (!key) { toast.push({ tone: "error", title: tt("Fill the required fields first.", "Lengkapi field wajib terlebih dahulu.") }); if (inputRef.current) inputRef.current.value = ""; return; }
    const bad = VwCheckFile(file, docType);
    if (bad) { toast.push({ tone: "error", title: tt("File not allowed", "File tidak diizinkan"), description: bad }); if (inputRef.current) inputRef.current.value = ""; return; }
    setBusy(true);
    setProgress(0);
    try {
      const created = await VwApiUploadDoc(file, docType, key, setProgress);
      if (!editing && created && created.id != null) sessionDocIdRef.current = created.id;
      await onDocChanged();
      if (typeof onUploaded === "function") onUploaded(key);
      toast.push({ title: tt("Uploaded", "Terunggah"), description: file.name });
    } catch (e) { toast.push({ tone: "error", title: tt("Upload failed", "Gagal unggah"), description: e.message }); }
    finally { setBusy(false); setProgress(null); if (inputRef.current) inputRef.current.value = ""; }
  };
  const removeDoc = async () => {
    if (!doc) return;
    setBusy(true);
    try { await VwApiDeleteDoc(doc.id); if (sessionDocIdRef.current === doc.id) sessionDocIdRef.current = null; await onDocChanged(); }
    catch (e) { toast.push({ tone: "error", title: tt("Delete failed", "Gagal hapus"), description: e.message }); }
    finally { setBusy(false); }
  };
  const markSaved = () => { savedRef.current = true; };
  const isSaved = () => savedRef.current;
  const cleanup = async () => {
    if (!savedRef.current && !editing && sessionDocIdRef.current != null) {
      const id = sessionDocIdRef.current; sessionDocIdRef.current = null;
      try { await VwApiDeleteDoc(id); await onDocChanged(); } catch (e) { /* best effort */ }
    }
  };

  const busyIndicator = progress != null ? <VwUploadProgress progress={progress} compact /> : (busy && <Spinner size={14} />);
  const field = (
    <Field label={tt("Document", "Dokumen")}>
      {doc ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => VwOpenDoc(doc.id, doc.fileName)} style={{ ...FONT, background: "none", border: "none", padding: 0, cursor: "pointer", color: C.ocean, fontWeight: 700, fontSize: 13, textDecoration: "underline", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{doc.fileName}</button>
          <IconButton size="sm" name="search" variant="secondary" title={tt("View", "Lihat")} onClick={() => VwOpenDoc(doc.id, doc.fileName)} />
          <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={removeDoc} />
          {busyIndicator}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input ref={inputRef} type="file" accept={rule ? rule.accept.join(",") : undefined} style={{ display: "none" }} onChange={(e) => upload(e.target.files && e.target.files[0])} />
          <Button size="sm" variant="secondary" iconLeft="upload" disabled={busy || !key} onClick={() => inputRef.current && inputRef.current.click()}>{tt("Choose file", "Pilih file")}</Button>
          {busyIndicator}
          <span style={{ fontSize: 11.5, color: C.textSubtle }}>{!key ? tt("fill required fields first", "lengkapi field wajib dulu") : (rule && `${rule.accept.join(", ")} · ${rule.maxMB < 1 ? Math.round(rule.maxMB * 1024) + "KB" : rule.maxMB + "MB"} max`)}</span>
        </div>
      )}
    </Field>
  );
  return { field, markSaved, isSaved, cleanup, doc };
}

/* KBLI add/edit modal */
function VwKbliModal({ open, onClose, editing, kbliSets, docs, onDocChanged, onSave }) {
  const tt = useTT();
  const toast = useToast();
  const [type, setType] = React.useState("");
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const r = editing && editing.row;
    setType(r ? (r.kbliTypeCode || "") : "");
    setCode(r ? (r.kbliCode || "") : "");
    setStatus(r ? (r.kbliStatusCode || "") : "");
  }, [open]);
  const sd = useVwSessionDoc(open, editing, "kbli", code, docs, onDocChanged);
  // Risk classification: show description only (hide code). Other KBLI selects keep code — name.
  const optRisk = (list) => [{ value: "", label: tt("— select —", "— pilih —") }, ...list.map((r) => ({ value: r.code, label: r.name }))];
  const opt = (list) => [{ value: "", label: tt("— select —", "— pilih —") }, ...list.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }))];
  const save = () => {
    if (!type) { toast.push({ tone: "error", title: tt("Select a risk classification.", "Pilih klasifikasi resiko.") }); return; }
    if (!code) { toast.push({ tone: "error", title: tt("Select a KBLI.", "Pilih KBLI.") }); return; }
    if (vwKbliNeedsDocument(type) && !(sd.doc && !sd.doc.isPlaceholder)) {
      toast.push({ tone: "error", title: tt("KBLI document is required for non-low risk.", "Dokumen KBLI wajib untuk klasifikasi resiko selain Rendah.") });
      return;
    }
    const rec = kbliSets.kbli.find((s) => s.code === code);
    sd.markSaved();
    onSave({ kbliTypeCode: type, kbliCode: code, kbliStatusCode: status, _label: rec ? rec.name : code }, editing ? editing.index : null);
    onClose();
  };
  const handleClose = async () => { await sd.cleanup(); onClose(); };
  const docRequired = vwKbliNeedsDocument(type);
  return (
    <Modal open={open} onClose={handleClose} width={560} icon="layers" title="KBLI" subtitle={tt("Add / Edit KBLI", "Tambah / Ubah KBLI")}
      footer={<><Button variant="secondary" onClick={handleClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="save" onClick={save}>{tt("Save", "Simpan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Klasifikasi Resiko", "Klasifikasi Resiko")}><Select value={type} options={optRisk(kbliSets.type)} onChange={(e) => setType(e.target.value)} /></Field>
        <Field label="KBLI No"><Select value={code} options={opt(kbliSets.kbli)} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label={tt("Status Sertifikat Standar/Izin", "Status Sertifikat Standar/Izin")}><Select value={status} options={opt(kbliSets.status)} onChange={(e) => setStatus(e.target.value)} /></Field>
        <div>
          {sd.field}
          {docRequired && <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--ag-danger, #b42318)" }}>{tt("Document required for this risk classification.", "Dokumen wajib untuk klasifikasi resiko ini.")}</div>}
        </div>
      </div>
    </Modal>
  );
}

/* Certificate add/edit modal */
function VwCertModal({ open, onClose, editing, docs, onDocChanged, onSave }) {
  const tt = useTT();
  const toast = useToast();
  const [number, setNumber] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [expire, setExpire] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const r = editing && editing.row;
    setNumber(r ? (r.number || "") : "");
    setDescription(r ? (r.description || "") : "");
    setExpire(r ? (r.expireDate || "") : "");
  }, [open]);
  const sd = useVwSessionDoc(open, editing, "sertifikat", number.trim(), docs, onDocChanged);
  const save = () => {
    if (!number.trim() || !description.trim()) { toast.push({ tone: "error", title: tt("Document number and description are required.", "No dokumen dan keterangan wajib diisi.") }); return; }
    sd.markSaved();
    onSave({ number: number.trim().slice(0, 50), description: description.trim().slice(0, 255), expireDate: expire || null }, editing ? editing.index : null);
    onClose();
  };
  const handleClose = async () => { await sd.cleanup(); onClose(); };
  return (
    <Modal open={open} onClose={handleClose} width={560} icon="award" title={tt("Certificate", "Sertifikat")} subtitle={tt("Add / Edit Certificate", "Tambah / Ubah Sertifikat")}
      footer={<><Button variant="secondary" onClick={handleClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="save" onClick={save}>{tt("Save", "Simpan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Document No *", "No. Dokumen *")}><TextInput value={number} maxLength={50} onChange={(e) => setNumber(vwAutoUpper(e.target.value))} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Description *", "Keterangan *")}><Textarea value={description} rows={3} maxLength={255} onChange={(e) => setDescription(vwAutoUpper(e.target.value))} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Expire Date", "Tanggal Kedaluwarsa")}><TextInput type="date" value={expire} onChange={(e) => setExpire(e.target.value)} /></Field>
        {sd.field}
      </div>
    </Modal>
  );
}

/* Format a raw digit string as an IDR value with thousands separators (id-ID). */
function VwFmtIdr(v) {
  const d = String(v == null ? "" : v).replace(/\D/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
}

/* Portfolio add/edit modal */
function VwPortfolioModal({ open, onClose, editing, docs, onDocChanged, onSave, onHold, onRelease }) {
  const C = useC();
  const tt = useTT();
  const toast = useToast();
  const [client, setClient] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [value, setValue] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const heldKeyRef = React.useRef("");
  React.useEffect(() => {
    if (!open) return;
    const r = editing && editing.row;
    setClient(r ? (r.client || "") : "");
    setScope(r ? (r.scopeOfWork || "") : "");
    setValue(r ? String(r.totalValue || "") : "");
    setStart(r ? String(r.contractStartDate || "").slice(0, 7) : "");
    setEnd(r ? String(r.contractEndDate || "").slice(0, 7) : "");
    heldKeyRef.current = "";
  }, [open]);
  const ownerKey = VwPortfolioOwnerKey(client, start);
  const buildRow = () => ({
    client: client.trim(),
    scopeOfWork: scope.trim(),
    totalValue: Number(value) || 0,
    contractStartDate: VwNormDateOnly(start),
    contractEndDate: VwNormDateOnly(end) || VwNormDateOnly(start),
  });
  const sd = useVwSessionDoc(open, editing, "portfolio", ownerKey, docs, onDocChanged, {
    onUploaded: (key) => {
      // Persist the owning portfolio row immediately so a concurrent Save as Draft / orphan
      // cleanup cannot delete this document before the modal's Save is clicked.
      if (!editing && onHold) {
        heldKeyRef.current = key;
        onHold(buildRow());
      }
    },
  });
  // Freeze natural-key fields once a document is bound — changing them would orphan the blob.
  const keyLocked = !!sd.doc;
  const save = () => {
    if (!client.trim() || !scope.trim() || !start || !end) { toast.push({ tone: "error", title: tt("Client, scope, start and end are required.", "Klien, lingkup, mulai & akhir wajib diisi.") }); return; }
    sd.markSaved();
    heldKeyRef.current = "";
    onSave(buildRow(), editing ? editing.index : null);
    onClose();
  };
  const handleClose = async () => {
    const held = heldKeyRef.current;
    const saved = sd.isSaved();
    await sd.cleanup();
    if (!editing && !saved && held && onRelease) onRelease(held);
    heldKeyRef.current = "";
    onClose();
  };
  return (
    <Modal open={open} onClose={handleClose} width={560} icon="briefcase" title={tt("Portfolio of Project", "Portofolio Proyek")} subtitle={tt("Add / Edit Project", "Tambah / Ubah Proyek")}
      footer={<><Button variant="secondary" onClick={handleClose}>{tt("Cancel", "Batal")}</Button><Button iconLeft="save" onClick={save}>{tt("Save", "Simpan")}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tt("Client *", "Klien *")}><TextInput value={client} disabled={keyLocked} onChange={(e) => setClient(vwAutoUpper(e.target.value))} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Scope of Work *", "Lingkup Kerja *")}><Textarea value={scope} rows={3} onChange={(e) => setScope(vwAutoUpper(e.target.value))} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Value (IDR)", "Nilai (IDR)")}><TextInput type="text" inputMode="numeric" value={VwFmtIdr(value)} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={tt("Contract start *", "Mulai kontrak *")}><TextInput type="month" value={start} disabled={keyLocked} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={tt("Contract end *", "Akhir kontrak *")}><TextInput type="month" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        {keyLocked && (
          <div style={{ fontSize: 11.5, color: C.textSubtle }}>
            {tt("Client and start month are locked while a document is attached. Remove the file to change them.", "Klien dan bulan mulai terkunci selama dokumen terlampir. Hapus berkas untuk mengubahnya.")}
          </div>
        )}
        {sd.field}
      </div>
    </Modal>
  );
}

/* ---------- STEP 2: Bio Data ---------- */
function VwStepBioData({ form, set, setForm, commit, me, countries, mapConfig, docs, reloadDocs, onModalOpenChange }) {
  const C = useC();
  const tt = useTT();
  const [cats, setCats] = React.useState([]);
  const [commOpen, setCommOpen] = React.useState(false);
  const commEnrichedRef = React.useRef(false);
  const [brands, setBrands] = React.useState([]);
  const [distTypes, setDistTypes] = React.useState([]);
  const [brandModal, setBrandModal] = React.useState(null);
  React.useEffect(() => {
    if (!onModalOpenChange) return undefined;
    onModalOpenChange(!!brandModal);
    return () => onModalOpenChange(false);
  }, [brandModal, onModalOpenChange]);

  React.useEffect(() => {
    VwApiMasterSet("commodity-category", { take: 1000 }).then(setCats);
    VwApiMasterSet("brand", { take: 3000 }).then(setBrands);
    VwApiMasterSet("distributor-type", { take: 100 }).then(setDistTypes);
  }, []);

  // A saved profile returns only sub-classification codes, so resolve their classification/category
  // names (once) from the master hierarchy for the commodity table.
  React.useEffect(() => {
    if (commEnrichedRef.current || cats.length === 0) return;
    if (!form.subClassifications.some((s) => !s._cls || !s._cat)) return;
    commEnrichedRef.current = true;
    Promise.all([
      VwApiMasterSet("commodity-classification", { take: 5000 }),
      VwApiMasterSet("commodity-subclassification", { take: 20000 }),
    ]).then(([clsList, subList]) => {
      const catMap = {}; cats.forEach((c) => { catMap[c.code] = c.name; });
      const clsMap = {}; clsList.forEach((c) => { clsMap[c.code] = { name: c.name, catCode: VwMasterParentCode(c, "CategoryId") }; });
      const subMap = {}; subList.forEach((s) => { subMap[s.code] = { name: s.name, clsCode: VwMasterParentCode(s, "ClassificationId") }; });
      setForm((f) => {
        let changed = false;
        const next = f.subClassifications.map((s) => {
          if (s._cls && s._cat) return s;
          const sub = subMap[s.subClassificationCode];
          const cls = sub && clsMap[sub.clsCode];
          changed = true;
          return {
            ...s,
            _label: s._label || (sub ? sub.name : s.subClassificationCode),
            _clsCode: s._clsCode || (sub ? sub.clsCode : ""),
            _cls: s._cls || (cls ? cls.name : ""),
            _catCode: s._catCode || (cls ? cls.catCode : ""),
            _cat: s._cat || (cls ? catMap[cls.catCode] || "" : ""),
          };
        });
        return changed ? { ...f, subClassifications: next } : f;
      });
    });
  }, [cats, form.subClassifications, setForm]);

  const opt = (list, ph) => [{ value: "", label: ph || tt("— select —", "— pilih —") }, ...list.map((r) => ({ value: r.code, label: r.name }))];
  const phoneOpt = [{ value: "", label: tt("— code —", "— kode —") },
    ...[...countries]
      .sort((a, b) => VwCountryName(a.name).localeCompare(VwCountryName(b.name)))
      .map((r) => ({ value: r.code, label: `${VwCountryName(r.name)} (${r.code})` }))];
  const upd = (k, v) => commit((f) => ({ ...f, [k]: v }));
  const F = (k) => (form[k] == null ? "" : form[k]);

  const distTypeName = (code) => { const d = distTypes.find((x) => x.code === code); return d ? d.name : (code || "—"); };
  const brandDoc = (brandName) => docs.find((d) => (d.documentType || "").toLowerCase() === "brand" && (d.ownerKey || "") === brandName);
  const saveBrand = (data, index) => commit((f) => ({
    ...f,
    brands: index != null ? f.brands.map((b, i) => (i === index ? data : b)) : [...f.brands, data],
  }));
  const removeBrand = async (i, r) => {
    const d = brandDoc(r.brandName);
    commit((f) => ({ ...f, brands: f.brands.filter((_, x) => x !== i) }));
    if (d) { try { await VwApiDeleteDoc(d.id); await reloadDocs(); } catch (e) { /* best effort */ } }
  };

  return (
    <>
      <VwCard title={tt("Vendor Information", "Informasi Vendor")}>
      <div className="ag-vw-three-column-grid">
        <Field label={tt("Vendor Name *", "Nama Vendor *")}><TextInput value={F("name")} onChange={(e) => set("name", e.target.value)} placeholder={tt("Enter Vendor Name", "Masukkan nama vendor")} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Person in Charge's Name", "Nama Penanggung Jawab")}><TextInput readOnly value={(me && me.name) || ""} /></Field>
        <Field label={tt("Position", "Jabatan")}><TextInput value={F("position")} onChange={(e) => set("position", e.target.value)} placeholder={tt("Enter Position", "Masukkan jabatan")} style={{ textTransform: "uppercase" }} /></Field>
        <Field label={tt("Email Address", "Alamat Email")}><TextInput readOnly value={(me && me.email) || ""} /></Field>
        <Field label={tt("Office Phone", "Telepon Kantor")}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 72px minmax(0, 1fr)", gap: 8 }}>
            <Select value={F("officePhoneCountry")} options={phoneOpt} onChange={(e) => set("officePhoneCountry", e.target.value)} />
            <TextInput value={F("officePhoneArea")} onChange={(e) => set("officePhoneArea", e.target.value.replace(/[^\d]/g, ""))} maxLength={8} placeholder={tt("Area", "Area")} />
            <TextInput value={F("officePhoneNumber")} onChange={(e) => set("officePhoneNumber", e.target.value.replace(/[^\d]/g, ""))} maxLength={20} placeholder={tt("Number", "Nomor")} />
          </div>
        </Field>
        <Field label={tt("Mobile Phone Number", "Nomor Handphone")}>
          <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: 8 }}>
            <Select value={F("handphoneCountry")} options={phoneOpt} onChange={(e) => set("handphoneCountry", e.target.value)} />
            <TextInput value={F("handphoneNumber")} onChange={(e) => set("handphoneNumber", e.target.value.replace(/[^\d]/g, ""))} maxLength={20} placeholder={tt("Phone number", "Nomor handphone")} />
          </div>
        </Field>
        <Field label={tt("Web Address", "Alamat Web")}><TextInput value={F("webAddress")} onChange={(e) => set("webAddress", e.target.value)} iconLeft="globe" placeholder="www.example.co.id" style={{ textTransform: "uppercase" }} /></Field>
      </div>
      <div className="ag-vw-two-column-grid" style={{ marginTop: 12 }}>
        <VwDocSlot slot={{ type: "logo", en: "Vendor Logo", id: "Logo Vendor" }} docs={docs} onChanged={reloadDocs} />
        <VwDocSlot slot={{ type: "org-structure", en: "Operational Organization Structure", id: "Struktur Organisasi Operasional" }} docs={docs} onChanged={reloadDocs} />
      </div>
      </VwCard>

      <VwAddressBlock title={tt("Office Address", "Alamat Kantor")} addr={form.office} countries={countries} mapConfig={mapConfig} onChange={(v) => set("office", v)} />
      <VwAddressBlock title={tt("Warehouse Address", "Alamat Gudang")} addr={form.warehouse} countries={countries} mapConfig={mapConfig} onChange={(v) => set("warehouse", v)} />
      <VwAddressBlock title={tt("Workshop / Operational Kitchen Address", "Alamat Workshop / Dapur Operasional")} addr={form.workshop} countries={countries} mapConfig={mapConfig} onChange={(v) => set("workshop", v)} />

      <VwCard title="Commodity">
      <div style={{ marginBottom: 12 }}>
        <Button variant="secondary" iconLeft="layers" onClick={() => setCommOpen(true)}>{tt("Select Commodity", "Pilih Commodity")}</Button>
      </div>
      {form.subClassifications.length > 0 ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: C.surfaceAlt, textAlign: "left" }}>
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Sub-classification", "Sub-klasifikasi")}</th>
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Classification", "Klasifikasi")}</th>
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Category", "Kategori")}</th>
                <th style={{ padding: "9px 12px", width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {form.subClassifications.map((r, i) => (
                <tr key={r.subClassificationCode} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600 }}>{r._label ? `${r.subClassificationCode} - ${r._label}` : r.subClassificationCode}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{r._cls || "—"}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{r._cat || "—"}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>
                    <IconButton size="sm" name="trash-2" title={tt("Remove", "Hapus")} onClick={() => commit((f) => ({ ...f, subClassifications: f.subClassifications.filter((_, x) => x !== i) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 8 }}>{tt("No commodities selected yet.", "Belum ada commodity dipilih.")}</div>
      )}
      {commOpen && <VwCommodityModal open onClose={() => setCommOpen(false)} cats={cats} initial={form.subClassifications} onSave={(rows) => upd("subClassifications", rows)} />}
      </VwCard>

      <VwCard title="Brand">
      <div style={{ marginBottom: 12 }}>
        <Button variant="secondary" iconLeft="plus" onClick={() => setBrandModal({ mode: "add" })}>{tt("Add Brand", "Tambah Brand")}</Button>
      </div>
      {form.brands.length > 0 ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: C.surfaceAlt, textAlign: "left" }}>
                <th style={{ padding: "9px 12px", width: 88 }} />
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Brand Name", "Nama Merek")}<span style={{ color: C.danger }}> *</span></th>
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Distributor Type", "Tipe Distributor")}<span style={{ color: C.danger }}> *</span></th>
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Expire Date", "Tanggal Kedaluwarsa")}</th>
                <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Document", "Dokumen")}</th>
              </tr>
            </thead>
            <tbody>
              {form.brands.map((r, i) => {
                const d = brandDoc(r.brandName);
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                    <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                      <IconButton size="sm" name="pencil" variant="secondary" title={tt("Edit", "Ubah")} onClick={() => setBrandModal({ mode: "edit", index: i, row: r })} />
                      <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={() => removeBrand(i, r)} />
                    </td>
                    <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600 }}>{r.brandName}</td>
                    <td style={{ padding: "9px 12px", color: C.textMuted }}>{distTypeName(r.distributorTypeCode)}</td>
                    <td style={{ padding: "9px 12px", color: C.textMuted }}>{r.expireDate || "—"}</td>
                    <td style={{ padding: "9px 12px", color: C.textMuted }}>
                      {d ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.fileName}</span>
                          <IconButton size="sm" name="search" variant="secondary" title={tt("View document", "Lihat dokumen")} onClick={() => VwOpenDoc(d.id, d.fileName)} />
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{tt("No brands added yet.", "Belum ada merek ditambahkan.")}</div>
      )}
      <VwBrandModal open={!!brandModal}
        editing={brandModal && brandModal.mode === "edit" ? { index: brandModal.index, row: brandModal.row } : null}
        brands={brands} distTypes={distTypes} docs={docs} onDocChanged={reloadDocs}
        onClose={() => setBrandModal(null)} onSave={saveBrand} />
      </VwCard>
    </>
  );
}

/* ---------- STEP 3: Persyaratan Umum (General Requirements) ---------- */
function VwStepUmum({ form, set, setForm, commit, docs, reloadDocs, kbliReqBySub, onModalOpenChange }) {
  const C = useC();
  const tt = useTT();
  const [kbliSets, setKbliSets] = React.useState({ kbli: [], type: [], status: [] });
  const [kbliModal, setKbliModal] = React.useState(null);

  React.useEffect(() => {
    Promise.all([VwApiMasterSet("kbli", { take: 4000 }), VwApiMasterSet("kbli-type", { take: 100 }), VwApiMasterSet("kbli-status", { take: 100 })])
      .then(([kbli, type, status]) => setKbliSets({ kbli, type, status }));
  }, []);
  React.useEffect(() => {
    if (!onModalOpenChange) return undefined;
    onModalOpenChange(!!kbliModal);
    return () => onModalOpenChange(false);
  }, [kbliModal, onModalOpenChange]);

  const F = (k) => (form[k] == null ? "" : form[k]);
  const npwpRequired = vwIsIndonesiaCountry(form.office && form.office.country);
  const kName = (list, code) => { const r = list.find((x) => x.code === code); return r ? r.name : (code || "—"); };
  const kbliDoc = (code) => docs.find((d) => (d.documentType || "").toLowerCase() === "kbli" && (d.ownerKey || "") === code);
  const saveKbli = (data, index) => commit((f) => ({
    ...f,
    kblis: index != null ? f.kblis.map((k, i) => (i === index ? data : k)) : [...f.kblis, data],
  }));
  const removeKbli = async (i, r) => {
    const d = kbliDoc(r.kbliCode);
    commit((f) => ({ ...f, kblis: f.kblis.filter((_, x) => x !== i) }));
    if (d) { try { await VwApiDeleteDoc(d.id); await reloadDocs(); } catch (e) { /* best effort */ } }
  };

  return (
    <>
      <VwCard title={tt("NPWP — Tax Registration", "NPWP — Registrasi Pajak")}>
      <div className="ag-vw-document-row-40-60">
        <Field label={npwpRequired ? "NPWP No. *" : "NPWP No."}>
          <TextInput
            value={F("npwpNo")}
            maxLength={npwpRequired ? 16 : 40}
            onChange={(e) => set("npwpNo", npwpRequired ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
            placeholder={npwpRequired ? tt("16 digits", "16 digit") : tt("Tax ID (optional)", "NPWP (opsional)")} />
        </Field>
        <div style={{ display: "flex", alignItems: "end", width: "100%" }}>
          <VwDocSlot slot={{ type: "npwp", en: "NPWP File", id: "File NPWP", required: npwpRequired }} docs={docs} onChanged={reloadDocs} />
        </div>
      </div>
      </VwCard>

      <VwCard title={tt("NIB — Nomor Induk Berusaha Berbasis Resiko", "NIB — Nomor Induk Berusaha Berbasis Resiko")}>
      <div className="ag-vw-document-row-40-60">
        <Field label="NIB No. *"><TextInput value={F("nibNo")} onChange={(e) => set("nibNo", e.target.value)} placeholder={tt("Enter NIB No.", "Masukkan No. NIB")} /></Field>
        <div style={{ display: "flex", alignItems: "end", width: "100%" }}>
          <VwDocSlot slot={{ type: "nib", en: "NIB File", id: "File NIB", required: true }} docs={docs} onChanged={reloadDocs} />
        </div>
      </div>
      </VwCard>

      <VwCard title={tt("Akta Pendirian, Perubahan Terakhir dan Penyesuaian (with SK Menkumham)", "Akta Pendirian, Perubahan Terakhir dan Penyesuaian beserta SK Menkumham")}>
      <div className="ag-vw-document-row-30-20-50">
        <Field label={tt("Akta Pendirian No. *", "No. Akta Pendirian *")}><TextInput value={F("aktaPendirianNo")} onChange={(e) => set("aktaPendirianNo", e.target.value)} /></Field>
        <Field label={tt("Akta Pendirian Date *", "Tanggal Akta Pendirian *")}><TextInput type="date" value={F("aktaPendirianDate")} onChange={(e) => set("aktaPendirianDate", e.target.value)} /></Field>
        <div style={{ display: "flex", alignItems: "end", width: "100%" }}>
          <VwDocSlot slot={{ type: "akta-pendirian", en: "Akta Pendirian File", id: "File Akta Pendirian", required: true }} docs={docs} onChanged={reloadDocs} />
        </div>
      </div>
      <div className="ag-vw-document-row-30-20-50" style={{ marginTop: 12 }}>
        <Field label={tt("Akta Perubahan No.", "No. Akta Perubahan")}><TextInput value={F("aktaPerubahanNo")} onChange={(e) => set("aktaPerubahanNo", e.target.value)} /></Field>
        <Field label={tt("Akta Perubahan Date", "Tanggal Akta Perubahan")}><TextInput type="date" value={F("aktaPerubahanDate")} onChange={(e) => set("aktaPerubahanDate", e.target.value)} /></Field>
        <div style={{ display: "flex", alignItems: "end", width: "100%" }}>
          <VwDocSlot slot={{ type: "akta-perubahan", en: "Akta Perubahan File", id: "File Akta Perubahan" }} docs={docs} onChanged={reloadDocs} />
        </div>
      </div>
      <div className="ag-vw-document-row-30-20-50" style={{ marginTop: 12 }}>
        <Field label={tt("Akta Penyesuaian No.", "No. Akta Penyesuaian")}><TextInput value={F("aktaPenyesuaianNo")} onChange={(e) => set("aktaPenyesuaianNo", e.target.value)} /></Field>
        <Field label={tt("Akta Penyesuaian Date", "Tanggal Akta Penyesuaian")}><TextInput type="date" value={F("aktaPenyesuaianDate")} onChange={(e) => set("aktaPenyesuaianDate", e.target.value)} /></Field>
        <div style={{ display: "flex", alignItems: "end", width: "100%" }}>
          <VwDocSlot slot={{ type: "akta-penyesuaian", en: "Akta Penyesuaian File", id: "File Akta Penyesuaian" }} docs={docs} onChanged={reloadDocs} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
        {tt("Akta Perubahan / Penyesuaian are optional — but number, date and file must be provided together.",
          "Akta Perubahan / Penyesuaian opsional — tetapi nomor, tanggal dan file harus diisi bersamaan.")}
      </div>
      </VwCard>

      <VwCard title={tt("SPPKP — Surat Pengusaha Pengukuhan Kena Pajak", "SPPKP — Surat Pengusaha Pengukuhan Kena Pajak")}>
      <div className="ag-vw-document-row-40-60">
        <Field label="SPPKP No. *"><TextInput value={F("sppkpNo")} onChange={(e) => set("sppkpNo", e.target.value)} /></Field>
        <div style={{ display: "flex", alignItems: "end", width: "100%" }}>
          <VwDocSlot slot={{ type: "sppkp", en: "SPPKP File", id: "File SPPKP", required: true }} docs={docs} onChanged={reloadDocs} />
        </div>
      </div>
      </VwCard>

      <VwCard title={tt("KBLI (Business Classification)", "KBLI (Klasifikasi Bisnis)")}>
      <Alert tone="info" title={tt("KBLI requirements", "Ketentuan KBLI")}
        description={tt("Below is the KBLI rule for each commodity selected on the previous page. Codes joined by AND must all be provided; groups joined by OR mean any one group is enough.",
          "Di bawah adalah aturan KBLI untuk setiap commodity yang dipilih di halaman sebelumnya. Kode yang dihubungkan AND harus semuanya ada; grup yang dihubungkan OR artinya cukup salah satu grup yang terpenuhi.")} />
      <div style={{ margin: "10px 0" }}>
        {form.subClassifications.map((s) => {
          const groups = kbliReqBySub[s.subClassificationCode] || [];
          const preview = VwKbliRulePreview(groups, "AND", "OR");
          return (
            <div key={s.subClassificationCode} style={{ fontSize: 12.5, color: C.textMuted, padding: "3px 0" }}>
              <strong style={{ color: C.text }}>{s._label || s.subClassificationCode}</strong>
              {": "}<span style={{ fontWeight: 500 }}>{preview || tt("no specific KBLI required", "tidak ada KBLI khusus")}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom: 12 }}>
        <Button variant="secondary" iconLeft="plus" onClick={() => setKbliModal({ mode: "add" })}>{tt("Add KBLI", "Tambah KBLI")}</Button>
      </div>
      {form.kblis.length > 0 ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ backgroundColor: C.surfaceAlt, textAlign: "left" }}>
              <th style={{ padding: "9px 12px", width: 88 }} />
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>KBLI</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Klasifikasi Resiko", "Klasifikasi Resiko")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>Status</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Attachment", "Lampiran")}</th>
            </tr></thead>
            <tbody>
              {form.kblis.map((r, i) => { const d = kbliDoc(r.kbliCode); return (
                <tr key={i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                    <IconButton size="sm" name="pencil" variant="secondary" title={tt("Edit", "Ubah")} onClick={() => setKbliModal({ mode: "edit", index: i, row: r })} />
                    <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={() => removeKbli(i, r)} />
                  </td>
                  <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600 }}>{r.kbliCode}{r._label ? " — " + r._label : ""}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{kName(kbliSets.type, r.kbliTypeCode)}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{kName(kbliSets.status, r.kbliStatusCode)}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{d ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.fileName}</span><IconButton size="sm" name="search" variant="secondary" title={tt("View document", "Lihat dokumen")} onClick={() => VwOpenDoc(d.id, d.fileName)} /></span>) : "—"}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{tt("No KBLI added yet.", "Belum ada KBLI ditambahkan.")}</div>
      )}
      <VwKbliModal open={!!kbliModal} editing={kbliModal && kbliModal.mode === "edit" ? { index: kbliModal.index, row: kbliModal.row } : null}
        kbliSets={kbliSets} docs={docs} onDocChanged={reloadDocs} onClose={() => setKbliModal(null)} onSave={saveKbli} />
      </VwCard>
    </>
  );
}

/* ---------- STEP 4: Persyaratan Khusus (Specific Requirements) ---------- */
function VwStepKhusus({ form, setForm, commit, docs, reloadDocs, derivedSpecialReqs, onModalOpenChange }) {
  const C = useC();
  const tt = useTT();
  const [certModal, setCertModal] = React.useState(null);
  React.useEffect(() => {
    if (!onModalOpenChange) return undefined;
    onModalOpenChange(!!certModal);
    return () => onModalOpenChange(false);
  }, [certModal, onModalOpenChange]);

  const setSr = (code, patch) => {
    const next = { ...patch };
    if (typeof next.number === "string") next.number = vwAutoUpper(next.number);
    if (typeof next.description === "string") next.description = vwAutoUpper(next.description);
    setForm((f) => {
      const list = f.specialRequirements.slice();
      const i = list.findIndex((x) => x.specialReqCode === code);
      if (i >= 0) list[i] = { ...list[i], ...next };
      else list.push({ specialReqCode: code, number: "", description: "", expireDate: null, ...next });
      return { ...f, specialRequirements: list };
    });
  };
  const certDoc = (number) => docs.find((d) => (d.documentType || "").toLowerCase() === "sertifikat" && (d.ownerKey || "") === number);
  const saveCert = (data, index) => commit((f) => ({
    ...f,
    sertifikats: index != null ? f.sertifikats.map((s, i) => (i === index ? data : s)) : [...f.sertifikats, data],
  }));
  const removeCert = async (i, r) => {
    const d = certDoc(r.number);
    commit((f) => ({ ...f, sertifikats: f.sertifikats.filter((_, x) => x !== i) }));
    if (d) { try { await VwApiDeleteDoc(d.id); await reloadDocs(); } catch (e) { /* best effort */ } }
  };

  return (
    <>
      <VwCard title={tt("Special Requirements (per selected commodity)", "Persyaratan Khusus (sesuai commodity terpilih)")}>
      {derivedSpecialReqs.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 12 }}>
          {tt("No special requirements apply to the selected commodities.", "Tidak ada persyaratan khusus untuk commodity yang dipilih.")}
        </div>
      )}
      {derivedSpecialReqs.map((r) => {
        const entry = form.specialRequirements.find((x) => x.specialReqCode === r.code) || {};
        return (
          <Card key={r.code} style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 10 }}>{r.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "0.75fr 1.65fr 0.6fr", gap: 10 }}>
              <Field label={`${r.code} No. *`}><TextInput value={entry.number || ""} onChange={(e) => setSr(r.code, { number: e.target.value })} placeholder={tt(`Enter ${r.code} No.`, `Masukkan No. ${r.code}`)} /></Field>
              <Field label={tt("Description", "Keterangan")}><TextInput value={entry.description || ""} onChange={(e) => setSr(r.code, { description: e.target.value })} /></Field>
              <Field label={tt("Expired Date", "Tanggal Kedaluwarsa")}><TextInput type="date" value={entry.expireDate || ""} onChange={(e) => setSr(r.code, { expireDate: e.target.value || null })} /></Field>
            </div>
            <div style={{ marginTop: 8 }}>
              <VwRowDoc docType="special-requirement" ownerKey={r.code} docs={docs} onChanged={reloadDocs} />
              {/* Derived from VW_FILE_RULES, like every other upload hint — a hardcoded copy of the
                  limit had already drifted from the rule once. */}
              <span style={{ fontSize: 11.5, color: C.textSubtle, marginLeft: 8 }}>{VwFileRuleHint("special-requirement")}</span>
            </div>
          </Card>
        );
      })}
      </VwCard>

      <VwCard title={(
        <span style={{ fontSize: 13.5, color: C.text, textTransform: "none", letterSpacing: 0 }}>
          {tt("SUPPORTING CERTIFICATE", "SERTIFIKAT PENDUKUNG")}
          <span style={{ fontSize: 12.5, fontWeight: 400, color: C.textMuted }}>
            {" — "}{tt("per supplied goods / services", "sesuai barang/jasa yang disupply")}
          </span>
        </span>
      )}>
      <div style={{ marginBottom: 12 }}>
        <Button variant="secondary" iconLeft="plus" onClick={() => setCertModal({ mode: "add" })}>{tt("Add Certificate", "Tambah Sertifikat")}</Button>
      </div>
      {form.sertifikats.length > 0 ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ backgroundColor: C.surfaceAlt, textAlign: "left" }}>
              <th style={{ padding: "9px 12px", width: 88 }} />
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Document No", "No. Dokumen")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Description", "Keterangan")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Expire Date", "Tanggal Kedaluwarsa")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Attachment", "Lampiran")}</th>
            </tr></thead>
            <tbody>
              {form.sertifikats.map((r, i) => { const d = certDoc(r.number); return (
                <tr key={i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                    <IconButton size="sm" name="pencil" variant="secondary" title={tt("Edit", "Ubah")} onClick={() => setCertModal({ mode: "edit", index: i, row: r })} />
                    <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={() => removeCert(i, r)} />
                  </td>
                  <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600 }}>{r.number}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{r.description || "—"}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{r.expireDate || "—"}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{d ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.fileName}</span><IconButton size="sm" name="search" variant="secondary" title={tt("View document", "Lihat dokumen")} onClick={() => VwOpenDoc(d.id, d.fileName)} /></span>) : "—"}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{tt("No certificates added yet.", "Belum ada sertifikat ditambahkan.")}</div>
      )}
      <VwCertModal open={!!certModal} editing={certModal && certModal.mode === "edit" ? { index: certModal.index, row: certModal.row } : null}
        docs={docs} onDocChanged={reloadDocs} onClose={() => setCertModal(null)} onSave={saveCert} />
      </VwCard>
    </>
  );
}

/* ---------- STEP 5: Portfolio of Project ---------- */
function VwStepPortfolio({ form, setForm, commit, docs, reloadDocs, onModalOpenChange }) {
  const tt = useTT();
  const C = useC();
  const { lang } = useI18n();
  const [pfModal, setPfModal] = React.useState(null);
  React.useEffect(() => {
    if (!onModalOpenChange) return undefined;
    onModalOpenChange(!!pfModal);
    return () => onModalOpenChange(false);
  }, [pfModal, onModalOpenChange]);

  const pfDoc = (r) => docs.find((d) => (d.documentType || "").toLowerCase() === "portfolio" && (d.ownerKey || "") === VwPortfolioOwnerKey(r.client, r.contractStartDate));
  const upsertPf = (data) => commit((f) => {
    const key = VwPortfolioOwnerKey(data.client, data.contractStartDate);
    const idx = f.portfolios.findIndex((p) => !VwIsOfficerPortfolio(p) && VwPortfolioOwnerKey(p.client, p.contractStartDate) === key);
    if (idx >= 0) return { ...f, portfolios: f.portfolios.map((p, i) => (i === idx ? { ...p, ...data, enteredByParty: "Vendor" } : p)) };
    return { ...f, portfolios: [...f.portfolios, { ...data, enteredByParty: "Vendor" }] };
  });
  const savePf = (data, index) => {
    if (index != null) {
      commit((f) => {
        const current = f.portfolios[index];
        if (VwIsOfficerPortfolio(current)) return f;
        return { ...f, portfolios: f.portfolios.map((p, i) => (i === index ? { ...p, ...data, enteredByParty: "Vendor" } : p)) };
      });
      return;
    }
    upsertPf(data);
  };
  const holdPf = (data) => upsertPf(data);
  const releasePf = (ownerKey) => commit((f) => ({
    ...f,
    portfolios: f.portfolios.filter((p) => VwIsOfficerPortfolio(p) || VwPortfolioOwnerKey(p.client, p.contractStartDate) !== ownerKey),
  }));
  const removePf = async (i, r) => {
    if (VwIsOfficerPortfolio(r)) return;
    const d = pfDoc(r);
    commit((f) => ({ ...f, portfolios: f.portfolios.filter((_, x) => x !== i) }));
    if (d) { try { await VwApiDeleteDoc(d.id); await reloadDocs(); } catch (e) { /* best effort */ } }
  };

  return (
    <>
      <VwCard title={tt("Portfolio of Project", "Portofolio Proyek")}>
      <div style={{ marginBottom: 12 }}>
        <Button variant="secondary" iconLeft="plus" onClick={() => setPfModal({ mode: "add" })}>{tt("Add Portfolio", "Tambah Portofolio")}</Button>
      </div>
      {form.portfolios.length > 0 ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ backgroundColor: C.surfaceAlt, textAlign: "left" }}>
              <th style={{ padding: "9px 12px", width: 88 }} />
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Client", "Klien")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Source", "Sumber")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Scope of Work", "Lingkup Kerja")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Value (IDR)", "Nilai (IDR)")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Period", "Periode")}</th>
              <th style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tt("Attachment", "Lampiran")}</th>
            </tr></thead>
            <tbody>
              {form.portfolios.map((r, i) => { const d = pfDoc(r); const officer = VwIsOfficerPortfolio(r); return (
                <tr key={r.id || i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                    {officer ? (
                      <span style={{ fontSize: 11, color: C.textSubtle }}>{tt("Read only", "Hanya lihat")}</span>
                    ) : (
                      <>
                        <IconButton size="sm" name="pencil" variant="secondary" title={tt("Edit", "Ubah")} onClick={() => setPfModal({ mode: "edit", index: i, row: r })} />
                        <IconButton size="sm" name="trash-2" variant="secondary" title={tt("Remove", "Hapus")} onClick={() => removePf(i, r)} />
                      </>
                    )}
                  </td>
                  <td style={{ padding: "9px 12px", color: C.text, fontWeight: 600 }}>{r.client}</td>
                  <td style={{ padding: "9px 12px" }}><Badge size="sm" tone={officer ? "brand" : "neutral"}>{officer ? tt("Officer", "Officer") : tt("Vendor", "Vendor")}</Badge></td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{r.scopeOfWork || "—"}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{Number(r.totalValue || 0).toLocaleString("id-ID")}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted, whiteSpace: "nowrap" }}>{VwFmtMonthYearRange(r.contractStartDate, r.contractEndDate, lang)}</td>
                  <td style={{ padding: "9px 12px", color: C.textMuted }}>{d ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.fileName}</span><IconButton size="sm" name="search" variant="secondary" title={tt("View document", "Lihat dokumen")} onClick={() => VwOpenDoc(d.id, d.fileName)} /></span>) : "—"}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{tt("No portfolio entries added yet.", "Belum ada portofolio ditambahkan.")}</div>
      )}
      <VwPortfolioModal open={!!pfModal} editing={pfModal && pfModal.mode === "edit" ? { index: pfModal.index, row: pfModal.row } : null}
        docs={docs} onDocChanged={reloadDocs} onClose={() => setPfModal(null)}
        onSave={savePf} onHold={holdPf} onRelease={releasePf} />
      </VwCard>
    </>
  );
}

/* ---------- form <-> DTO mapping ---------- */
function VwEmptyAddress() {
  return { address: "", addressCode: "", provinceCode: "", cityCode: "", districtCode: "", villageCode: "", postCode: "", country: "Indonesia", latitude: null, longitude: null };
}
function VwAddrFromDto(d) {
  if (!d) return VwEmptyAddress();
  return {
    address: d.address || "", addressCode: d.addressCode || "", provinceCode: d.provinceCode || "",
    cityCode: d.cityCode || "", districtCode: d.districtCode || "", villageCode: d.villageCode || "",
    postCode: d.postCode || "", country: d.country || "Indonesia",
    latitude: d.latitude != null ? d.latitude : null, longitude: d.longitude != null ? d.longitude : null,
  };
}
function VwProfileToForm(p) {
  const x = p || {};
  return {
    name: x.name || "",
    position: x.position || "", officePhoneCountry: x.officePhoneCountry || "", officePhoneArea: x.officePhoneArea || "", officePhoneNumber: x.officePhoneNumber || "",
    handphoneCountry: x.handphoneCountry || "", handphoneNumber: x.handphoneNumber || "", webAddress: x.webAddress || "",
    office: VwAddrFromDto(x.office), warehouse: VwAddrFromDto(x.warehouse), workshop: VwAddrFromDto(x.workshop),
    npwpNo: x.npwpNo || "", nibNo: x.nibNo || "",
    aktaPendirianNo: x.aktaPendirianNo || "", aktaPendirianDate: x.aktaPendirianDate || "",
    aktaPerubahanNo: x.aktaPerubahanNo || "", aktaPerubahanDate: x.aktaPerubahanDate || "",
    aktaPenyesuaianNo: x.aktaPenyesuaianNo || "", aktaPenyesuaianDate: x.aktaPenyesuaianDate || "",
    sppkpNo: x.sppkpNo || "", isBiodataTrue: !!x.isBiodataTrue, isAgreeSubmit: !!x.isAgreeSubmit,
    subClassifications: (x.subClassifications || []).map((s) => ({ subClassificationCode: s.subClassificationCode })),
    kblis: (x.kblis || []).map((k) => ({ kbliTypeCode: k.kbliTypeCode, kbliCode: k.kbliCode, kbliStatusCode: k.kbliStatusCode })),
    brands: (x.brands || []).map((b) => ({ brandName: b.brandName, distributorTypeCode: b.distributorTypeCode, isOther: !!b.isOther, expireDate: b.expireDate || null })),
    // API contract renamed sertifikat -> certificate (VENDOR_CERTIFICATE_T); keep the wizard's internal "sertifikats" shape.
    sertifikats: (x.certificates || []).map((s) => ({ number: s.certificateNumber, description: s.description, expireDate: s.expireDate || null })),
    portfolios: (x.portfolios || []).map((p2) => ({
      id: p2.id,
      enteredByParty: p2.enteredByParty || "Vendor",
      client: p2.client,
      scopeOfWork: p2.scopeOfWork,
      totalValue: p2.totalValue,
      contractStartDate: VwNormDateOnly(p2.contractStartDate),
      contractEndDate: VwNormDateOnly(p2.contractEndDate),
    })),
    specialRequirements: (x.specialRequirements || []).map((s) => ({ specialReqCode: s.specialReqCode, number: s.number, description: s.description, expireDate: s.expireDate || null })),
  };
}
function VwAddrToDto(a) {
  return {
    address: a.address || null, addressCode: a.addressCode || null, provinceCode: a.provinceCode || null,
    cityCode: a.cityCode || null, districtCode: a.districtCode || null, villageCode: a.villageCode || null,
    postCode: a.postCode || null, country: a.country || null,
    latitude: a.latitude != null && a.latitude !== "" ? Number(a.latitude) : null,
    longitude: a.longitude != null && a.longitude !== "" ? Number(a.longitude) : null,
  };
}
function VwFormToPayload(f, submit) {
  const clean = (s) => (s && String(s).trim() ? vwAutoUpper(String(s).trim()) : null);
  const cleanAddr = (a) => {
    const dto = VwAddrToDto(a);
    return {
      ...dto,
      address: dto.address ? vwAutoUpper(dto.address) : null,
      postCode: dto.postCode ? vwAutoUpper(dto.postCode) : null,
    };
  };
  return {
    vendorId: "", // resolved server-side from the session
    name: clean(f.name),
    position: clean(f.position), officePhoneCountry: clean(f.officePhoneCountry), officePhoneArea: clean(f.officePhoneArea), officePhoneNumber: clean(f.officePhoneNumber),
    handphoneCountry: clean(f.handphoneCountry), handphoneNumber: clean(f.handphoneNumber), webAddress: clean(f.webAddress),
    office: cleanAddr(f.office), warehouse: cleanAddr(f.warehouse), workshop: cleanAddr(f.workshop),
    npwpNo: clean(f.npwpNo), nibNo: clean(f.nibNo),
    aktaPendirianNo: clean(f.aktaPendirianNo), aktaPendirianDate: f.aktaPendirianDate || null,
    aktaPerubahanNo: clean(f.aktaPerubahanNo), aktaPerubahanDate: f.aktaPerubahanDate || null,
    aktaPenyesuaianNo: clean(f.aktaPenyesuaianNo), aktaPenyesuaianDate: f.aktaPenyesuaianDate || null,
    sppkpNo: clean(f.sppkpNo), isBiodataTrue: !!f.isBiodataTrue, isAgreeSubmit: !!f.isAgreeSubmit,
    subClassifications: f.subClassifications.map((s) => ({ subClassificationCode: s.subClassificationCode })),
    kblis: f.kblis.map((k) => ({ kbliTypeCode: k.kbliTypeCode || "", kbliCode: k.kbliCode, kbliStatusCode: k.kbliStatusCode || "" })),
    brands: f.brands.map((b) => ({ brandName: b.brandName ? vwAutoUpper(b.brandName) : b.brandName, distributorTypeCode: b.distributorTypeCode || null, expireDate: b.expireDate || null })),
    certificates: f.sertifikats.map((s) => ({ certificateNumber: s.number ? vwAutoUpper(s.number) : s.number, description: s.description ? vwAutoUpper(s.description) : null, expireDate: s.expireDate || null })),
    portfolios: f.portfolios
      .filter((p) => !VwIsOfficerPortfolio(p))
      .map((p) => ({ client: p.client ? vwAutoUpper(p.client) : p.client, scopeOfWork: p.scopeOfWork ? vwAutoUpper(p.scopeOfWork) : p.scopeOfWork, totalValue: Number(p.totalValue) || 0, contractStartDate: VwNormDateOnly(p.contractStartDate), contractEndDate: VwNormDateOnly(p.contractEndDate) })),
    specialRequirements: f.specialRequirements
      .filter((s) => String(s.number || "").trim() || String(s.description || "").trim() || s.expireDate)
      .map((s) => ({ specialReqCode: s.specialReqCode, number: s.number ? vwAutoUpper(s.number) : null, description: s.description ? vwAutoUpper(s.description) : null, expireDate: s.expireDate || null })),
    submit: !!submit,
  };
}

export { VendorProfileWizard, VwLoadAtlas, VwProfileToForm, VwFormToPayload, vwIsIndonesiaCountry };
Object.assign(window, { VendorProfileWizard, VwLoadAtlas, VwProfileToForm, VwFormToPayload, vwIsIndonesiaCountry });
