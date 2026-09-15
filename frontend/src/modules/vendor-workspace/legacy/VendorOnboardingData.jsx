/* Alamtri Geo Admin — Vendor Workspace onboarding: invitation + token store.
   Invite-only registration: ONLY vendors holding a valid invitation token may
   register. Procurement issues invitations (Vendor Onboarding → Vendor Invitation),
   the vendor redeems the token on the pre-login registration screen.

   Shared through backend state API so the invitation screen (writer) and the registration
   screen (reader/validator) see the same tokens across navigation. */

const VW_INTERNAL_INVITATIONS_API = "/api/v1/vendor-onboarding/invitations";
const VW_PUBLIC_REGISTRATION_API = "/api/v1/public/vendor-registration";
const VW_VENDOR_AUTH_API = "/api/v1/vendor/auth";

/* invitation lifecycle */
const ONBOARD_STATUS = {
  DRAFT:      { en: "Draft",      id: "Draf",         tone: "neutral" },
  SENT:       { en: "Sent",       id: "Terkirim",     tone: "info" },
  OPENED:     { en: "Opened",     id: "Dibuka",       tone: "brand" },
  REGISTERED: { en: "Registered", id: "Terdaftar",    tone: "success" },
  EXPIRED:    { en: "Expired",    id: "Kedaluwarsa",  tone: "warning" },
  REVOKED:    { en: "Revoked",    id: "Dicabut",      tone: "danger" },
};

/* Invitation expiry math runs on the WIB calendar (Asia/Jakarta, UTC+7, no DST) so "today" and the
   day-counts never drift by a day on a browser in another timezone. Values are bare "YYYY-MM-DD"
   calendar strings. en-CA yields an ISO "YYYY-MM-DD" date in the requested timezone. */
function VwWibDateStr(instant) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}
function VwAddDays(dateStr, days) {
  const ms = new Date(dateStr + "T00:00:00+07:00").getTime() + days * 86400000;
  return VwWibDateStr(new Date(ms));
}
function VwTodayStr() {
  return VwWibDateStr(new Date());
}
function VwDaysUntil(dateStr) {
  const target = new Date(dateStr + "T00:00:00+07:00").getTime();
  const today = new Date(VwTodayStr() + "T00:00:00+07:00").getTime();
  return Math.round((target - today) / 86400000);
}

/* effective status accounts for time-based expiry without mutating storage */
function VwEffectiveStatus(inv) {
  if (["REGISTERED", "REVOKED", "DRAFT"].includes(inv.status)) return inv.status;
  if (inv.expiresAt && VwDaysUntil(inv.expiresAt) < 0) return "EXPIRED";
  return inv.status;
}
function VwNormalizeToken(t) { return String(t || "").trim().toUpperCase(); }
function VwNormalizeInvitation(raw, extras) {
  const dto = raw || {};
  const status = String(dto.status || dto.Status || "Draft").toUpperCase();
  const invite = {
    id: String(dto.id || dto.Id || ""),
    company: dto.vendorName || dto.VendorName || "",
    pic: dto.picName || dto.PicName || "",
    email: dto.email || dto.Email || "",
    category: dto.category || dto.Category || "",
    token: extras && extras.invitationCode ? extras.invitationCode : (dto.codeMasked || dto.CodeMasked || ""),
    status,
    invitedBy: dto.createdBy || dto.CreatedBy || "System",
    sentAt: ((dto.createdAt || dto.CreatedAt || "") + "").slice(0, 10),
    expiresAt: ((dto.expiredAt || dto.ExpiredAt || "") + "").slice(0, 10),
    note: dto.note || dto.Note || "",
    registrationUrl: extras && extras.registrationUrl ? extras.registrationUrl : null,
    codeMasked: dto.codeMasked || dto.CodeMasked || "",
    usedAt: dto.usedAt || dto.UsedAt || null,
    vendorId: dto.vendorId || dto.VendorId || "",
  };
  return invite;
}

async function VwApiJson(url, options) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", ...(options && options.headers ? options.headers : {}) },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error((data && (data.message || data.title || data.code)) || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function VwApiListInvites() {
  const items = await VwApiJson(VW_INTERNAL_INVITATIONS_API);
  return (Array.isArray(items) ? items : []).map((item) => VwNormalizeInvitation(item));
}

async function VwApiCreateInvite(payload) {
  const result = await VwApiJson(VW_INTERNAL_INVITATIONS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return {
    invite: VwNormalizeInvitation(result.invitation, {
      invitationCode: result.invitationCode,
      registrationUrl: result.registrationUrl,
    }),
    invitationCode: result.invitationCode,
    registrationUrl: result.registrationUrl,
  };
}

async function VwApiReissueInvite(invitationId) {
  const result = await VwApiJson(`${VW_INTERNAL_INVITATIONS_API}/${invitationId}/resend`, {
    method: "POST",
  });
  return {
    invite: VwNormalizeInvitation(result.invitation, {
      invitationCode: result.invitationCode,
      registrationUrl: result.registrationUrl,
    }),
    invitationCode: result.invitationCode,
    registrationUrl: result.registrationUrl,
  };
}

async function VwApiRevokeInvite(invitationId) {
  const result = await VwApiJson(`${VW_INTERNAL_INVITATIONS_API}/${invitationId}/revoke`, {
    method: "POST",
  });
  return VwNormalizeInvitation(result);
}

async function VwApiValidateInvite(invitationCode, email) {
  const result = await VwApiJson(`${VW_PUBLIC_REGISTRATION_API}/validate-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitationCode, email: email || null }),
  });
  return {
    isValid: !!result.isValid,
    failureReason: result.failureReason || null,
    invitation: result.invitation ? VwNormalizeInvitation(result.invitation, { invitationCode }) : null,
  };
}

async function VwApiRegisterVendor(payload) {
  return VwApiJson(`${VW_PUBLIC_REGISTRATION_API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function VwApiVendorLogin(email, password) {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function VwApiVendorLoginOtp(email, code) {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/login/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

async function VwApiVendorMe() {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/me`);
}

async function VwApiVerifyPassword(password) {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

async function VwApiVendorLogout() {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/logout`, { method: "POST" });
}

async function VwApiChangePassword(currentPassword, newPassword) {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

async function VwApiRequestPasswordReset(email) {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

async function VwApiConfirmPasswordReset(email, resetToken, newPassword) {
  return VwApiJson(`${VW_VENDOR_AUTH_API}/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, resetToken, newPassword }),
  });
}

/* ---- vendor self-service portal (post-login): profile + documents + master data ----
   All routes are ownership-scoped server-side to the authenticated vendor. */
const VW_VENDOR_PORTAL_API = "/api/v1/vendor-portal";
const VW_MASTER_DATA_API = "/api/v1/vendor-portal/master-data";

async function VwApiGetProfile() {
  return VwApiJson(`${VW_VENDOR_PORTAL_API}/profile`);
}

async function VwApiGetCertificate() {
  return VwApiJson(`${VW_VENDOR_PORTAL_API}/certificate`);
}

async function VwApiSaveProfile(payload) {
  return VwApiJson(`${VW_VENDOR_PORTAL_API}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function VwApiListDocs() {
  return VwApiJson(`${VW_VENDOR_PORTAL_API}/documents`);
}

/** Normalize a contract month/date to yyyy-MM-dd (HTML month input → day 01). */
function VwNormDateOnly(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return s.slice(0, 10);
}

/** Portfolio document OwnerKey — `{client}|{yyyy-MM-dd}`. Must match backend orphan cleanup. */
function VwPortfolioOwnerKey(client, startDate) {
  const c = String(client || "").trim();
  const d = VwNormDateOnly(startDate);
  return c && d ? `${c}|${d}` : "";
}

/** Month + year only (input is type=month, stored as yyyy-MM-01). */
function VwFmtMonthYear(d, lang) {
  if (!d) return "—";
  const months = lang === "id"
    ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = String(d).slice(0, 10).split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!y || !m || m < 1 || m > 12) return "—";
  return `${months[m - 1]} ${y}`;
}

function VwFmtMonthYearRange(start, end, lang) {
  const from = VwFmtMonthYear(start, lang);
  const to = VwFmtMonthYear(end, lang);
  if (from === "—" && to === "—") return "—";
  return `${from} – ${to}`;
}

function VwIsOfficerPortfolio(row) {
  return String((row && row.enteredByParty) || "Vendor").toLowerCase() === "officer";
}

/** Officer party = role OFFCR-VDR or SPR-ADM (session carries display names). */
function VwIsOfficerVendorActor(roles) {
  const set = new Set((roles || []).map((item) => String(item)));
  return set.has("Officer Vendor Onboarding") || set.has("OFFCR-VDR")
    || set.has("Super Admin") || set.has("SPR-ADM");
}

function VwOfficerPortfolioWritable(status, approvalContext) {
  const code = String(status || "").toUpperCase();
  if (code === "APPRV" || code === "RGSTD") return true;
  if (approvalContext && approvalContext.awaitingApproval) return true;
  return code === "SBMIT" || code === "APPR1" || code === "APPR2";
}

/** The server's upload rules (extensions + max bytes per docType), for the portal's pre-check. */
async function VwApiDocRules() {
  const response = await fetch(`${VW_VENDOR_PORTAL_API}/documents/rules`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Rules unavailable (${response.status})`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/** Parse JSON error body from XHR/fetch; prefer message/code when present. */
function VwUploadErrorMessage(xhrOrStatus, responseText, fallback) {
  const status = typeof xhrOrStatus === "number" ? xhrOrStatus : (xhrOrStatus && xhrOrStatus.status);
  let data = null;
  if (responseText) {
    try { data = JSON.parse(responseText); } catch (e) { data = null; }
  }
  const detail = (data && (data.message || data.code || data.title)) || "";
  if (status === 413) return detail || "File too large for the upload gateway (HTTP 413).";
  if (status === 502 || status === 504) {
    return detail || `Upload timed out or was cut off by the gateway (HTTP ${status}).`;
  }
  return detail || fallback || `Upload failed (${status || "no response"})`;
}

/** True when the write URL is Azure Blob (SAS). Same-origin proxy PUTs need cookies. */
function VwIsAzureBlobUploadUrl(url) {
  return /^https?:\/\/[^/]*blob\.core\.windows\.net\b/i.test(String(url || ""));
}

/** PUT file bytes to a Blob write-SAS URL (or AppHost proxy) with optional progress (0–100). */
function VwPutBlobWithProgress(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    if (!VwIsAzureBlobUploadUrl(uploadUrl)) xhr.withCredentials = true;
    if (VwIsAzureBlobUploadUrl(uploadUrl)) xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    if (typeof onProgress === "function" && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !event.total) return;
        onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
      };
      xhr.upload.onload = () => onProgress(100);
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(true);
        return;
      }
      reject(new Error(VwUploadErrorMessage(xhr.status, xhr.responseText, `Blob upload failed (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error("Blob upload failed (network/CORS). Check storage CORS for this site origin."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}

/** Same-origin multipart upload (AppHost → Blob via Managed Identity). Used when write SAS cannot be signed. */
async function VwApiUploadDocViaAppHost(file, docType, ownerKey, onProgress) {
  if (typeof onProgress === "function") onProgress(0);
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("docType", docType);
  if (ownerKey) form.append("ownerKey", ownerKey);
  const res = await fetch(`${VW_VENDOR_PORTAL_API}/documents/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = null; }
  }
  if (!res.ok) {
    throw new Error(VwUploadErrorMessage(res.status, text, "Could not save uploaded document."));
  }
  if (typeof onProgress === "function") onProgress(100);
  return data;
}

/** Upload a vendor document with optional byte-progress callback (0–100).
   Direct-to-Blob via write SAS so large files do not traverse AppHost twice. */
async function VwApiUploadDoc(file, docType, ownerKey, onProgress) {
  if (typeof onProgress === "function") onProgress(0);

  const sessionRes = await fetch(`${VW_VENDOR_PORTAL_API}/documents/upload-session`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      docType,
      ownerKey: ownerKey || null,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });
  const sessionText = await sessionRes.text();
  let session = null;
  if (sessionText) {
    try { session = JSON.parse(sessionText); } catch (e) { session = null; }
  }
  if (!sessionRes.ok) {
    // Production used to 500 here when User Delegation SAS could not be signed.
    if (sessionRes.status >= 500) {
      return VwApiUploadDocViaAppHost(file, docType, ownerKey, onProgress);
    }
    throw new Error(VwUploadErrorMessage(sessionRes.status, sessionText, "Could not start upload."));
  }
  if (!session || !session.uploadUrl || !session.container || !session.blobKey) {
    return VwApiUploadDocViaAppHost(file, docType, ownerKey, onProgress);
  }

  await VwPutBlobWithProgress(session.uploadUrl, file, onProgress);

  const completeRes = await fetch(`${VW_VENDOR_PORTAL_API}/documents/complete-upload`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      docType,
      ownerKey: ownerKey || null,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      container: session.container,
      blobKey: session.blobKey,
    }),
  });
  const completeText = await completeRes.text();
  let data = null;
  if (completeText) {
    try { data = JSON.parse(completeText); } catch (e) { data = null; }
  }
  if (!completeRes.ok) {
    throw new Error(VwUploadErrorMessage(completeRes.status, completeText, "Could not save uploaded document."));
  }
  return data;
}

async function VwApiDeleteDoc(documentId) {
  const response = await fetch(`${VW_VENDOR_PORTAL_API}/documents/${documentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Delete failed (${response.status})`);
  }
  return true;
}

async function VwApiDocDownloadUrl(documentId) {
  const data = await VwApiJson(`${VW_VENDOR_PORTAL_API}/documents/${documentId}/download`);
  return data && data.url ? data.url : null;
}

async function VwResolveFramedDocumentUrl(url) {
  if (!url) return "";
  if (/^https?:\/\/[^/]*blob\.core\.windows\.net\b/i.test(url)) return url;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`preview_unavailable (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/* Requests the in-app PDF viewer (VwPdfDocumentViewer) to open a document. The viewer resolves the
   short-lived SAS URL itself and renders it in a modal iframe — same behaviour as the internal
   Tracker document viewer, rather than opening a new browser tab. */
function VwOpenDoc(documentId, fileName) {
  try {
    window.dispatchEvent(new CustomEvent("vw:view-doc", { detail: { id: documentId, fileName: fileName || "" } }));
  } catch (e) {
    // Fallback: if CustomEvent is unavailable, resolve + open in a new tab.
    VwApiDocDownloadUrl(documentId).then((url) => { if (url) window.open(url, "_blank", "noopener"); });
  }
}

async function VwApiMapConfig() {
  try {
    return await VwApiJson(`${VW_VENDOR_PORTAL_API}/map-config`);
  } catch (e) {
    return { subscriptionKey: "", country: "IDN" };
  }
}

/* Generic master-data reader. Returns the raw records [{ code, name, payloadJson, parentCode, ... }].
   Cascade by passing { parent: <parentCode> }; server filters via the ParentCode column. */
async function VwApiMasterSet(key, params) {
  const q = new URLSearchParams();
  if (params && params.parent) q.set("parent", params.parent);
  if (params && params.search) q.set("search", params.search);
  if (params && params.take) q.set("take", String(params.take));
  const qs = q.toString();
  try {
    const data = await VwApiJson(`${VW_MASTER_DATA_API}/${key}${qs ? `?${qs}` : ""}`);
    return (data && Array.isArray(data.records)) ? data.records : [];
  } catch (e) {
    return [];
  }
}

function VwParsePayload(record) {
  if (!record || !record.payloadJson) return {};
  try { return JSON.parse(record.payloadJson) || {}; } catch (e) { return {}; }
}

/* Email logging is fully backend-owned: every real send is recorded to core.EMAIL_SENT_T by the
   server (SmtpEmailSender), and the Email Sent log reads it from /api/v1/super-admin/email-sent.
   The former client-side browser-storage "outbox" (VwSendEmail/VwLoadOutbox) was removed — it
   double-logged emails the backend already records and violated the no-browser-storage rule. */

/* ---- password policy (Super Admin ▸ Settings ▸ Security) ----
   Vendor password rules follow the configured policy so the checklist + client-side validation
   match backend enforcement exactly. Cached after the first fetch; falls back to the safe default
   (12 chars + all classes) if the endpoint is unreachable. */
const VW_DEFAULT_PWD_POLICY = { minLength: 12, requireDigit: true, requireLowercase: true, requireUppercase: true, requireNonAlphanumeric: true };
let _vwPwdPolicy = null;
async function VwApiPasswordPolicy() {
  if (_vwPwdPolicy) return _vwPwdPolicy;
  try {
    const d = await VwApiJson(`${VW_PUBLIC_REGISTRATION_API}/password-policy`);
    _vwPwdPolicy = {
      minLength: Number(d && d.minLength) || VW_DEFAULT_PWD_POLICY.minLength,
      requireDigit: !!(d && d.requireDigit),
      requireLowercase: !!(d && d.requireLowercase),
      requireUppercase: !!(d && d.requireUppercase),
      requireNonAlphanumeric: !!(d && d.requireNonAlphanumeric),
    };
  } catch (e) {
    _vwPwdPolicy = { ...VW_DEFAULT_PWD_POLICY };
  }
  return _vwPwdPolicy;
}
/* Build the checklist rows for VwPasswordRuleList from the active policy (tt = translator). */
function VwPwdChecks(password, policy, tt) {
  const p = policy || VW_DEFAULT_PWD_POLICY;
  const pwd = password || "";
  const rows = [{ ok: pwd.length >= p.minLength, label: tt(`At least ${p.minLength} characters`, `Minimal ${p.minLength} karakter`) }];
  if (p.requireUppercase) rows.push({ ok: /[A-Z]/.test(pwd), label: tt("Contains an uppercase letter", "Mengandung huruf besar") });
  if (p.requireLowercase) rows.push({ ok: /[a-z]/.test(pwd), label: tt("Contains a lowercase letter", "Mengandung huruf kecil") });
  if (p.requireDigit) rows.push({ ok: /[0-9]/.test(pwd), label: tt("Contains a number", "Mengandung angka") });
  if (p.requireNonAlphanumeric) rows.push({ ok: /[^a-zA-Z0-9]/.test(pwd), label: tt("Contains a symbol", "Mengandung simbol") });
  return rows;
}
/* True when the password satisfies every rule in the active policy. */
function VwPwdValid(password, policy) {
  return VwPwdChecks(password, policy, (en) => en).every((r) => r.ok);
}

export {
  ONBOARD_STATUS,
  VwAddDays, VwTodayStr, VwDaysUntil,
  VwEffectiveStatus, VwNormalizeToken,
  VwNormalizeInvitation,
  VW_DEFAULT_PWD_POLICY, VwApiPasswordPolicy, VwPwdChecks, VwPwdValid,
  VwApiListInvites, VwApiCreateInvite, VwApiReissueInvite, VwApiRevokeInvite,
  VwApiValidateInvite, VwApiRegisterVendor,
  VwApiVendorLogin, VwApiVendorLoginOtp, VwApiVendorMe, VwApiVendorLogout,
  VwApiVerifyPassword, VwApiChangePassword,
  VwApiRequestPasswordReset, VwApiConfirmPasswordReset,
  VW_VENDOR_PORTAL_API, VW_MASTER_DATA_API,
  VwApiGetProfile, VwApiSaveProfile, VwApiGetCertificate,
  VwApiListDocs, VwApiUploadDoc, VwApiDeleteDoc, VwApiDocRules,
  VwApiDocDownloadUrl, VwResolveFramedDocumentUrl, VwOpenDoc,
  VwApiMapConfig, VwApiMasterSet, VwParsePayload,
  VwNormDateOnly, VwPortfolioOwnerKey, VwFmtMonthYear, VwFmtMonthYearRange,
  VwIsOfficerPortfolio, VwIsOfficerVendorActor, VwOfficerPortfolioWritable,
};
Object.assign(window, {
  ONBOARD_STATUS,
  VwAddDays, VwTodayStr, VwDaysUntil,
  VwEffectiveStatus, VwNormalizeToken,
  VwNormalizeInvitation,
  VW_DEFAULT_PWD_POLICY, VwApiPasswordPolicy, VwPwdChecks, VwPwdValid,
  VwApiListInvites, VwApiCreateInvite, VwApiReissueInvite, VwApiRevokeInvite,
  VwApiValidateInvite, VwApiRegisterVendor,
  VwApiVendorLogin, VwApiVendorLoginOtp, VwApiVendorMe, VwApiVendorLogout,
  VwApiVerifyPassword, VwApiChangePassword,
  VwApiRequestPasswordReset, VwApiConfirmPasswordReset,
  VW_VENDOR_PORTAL_API, VW_MASTER_DATA_API,
  VwApiGetProfile, VwApiSaveProfile, VwApiGetCertificate,
  VwApiListDocs, VwApiUploadDoc, VwApiDeleteDoc, VwApiDocRules,
  VwApiDocDownloadUrl, VwResolveFramedDocumentUrl, VwOpenDoc,
  VwApiMapConfig, VwApiMasterSet, VwParsePayload,
  VwNormDateOnly, VwPortfolioOwnerKey, VwFmtMonthYear, VwFmtMonthYearRange,
  VwIsOfficerPortfolio, VwIsOfficerVendorActor, VwOfficerPortfolioWritable,
});
