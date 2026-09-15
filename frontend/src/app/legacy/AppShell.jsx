/* Shared internal shell: providers, auth, kebab URLs, administration screens.
   Business-module screens are injected per portal so Vite can emit separate artifacts. */
import React from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { ImpersonationBar, SideNav, TopBar } from "../shell/legacy/Shell.jsx";
import { Holiday } from "../../platform/administration/legacy/ScreensHoliday.jsx";
import { Users } from "../../platform/administration/legacy/ScreensUsers.jsx";
import { VendorContacts } from "../../platform/administration/legacy/ScreensVendorContacts.jsx";
import { Roles } from "../../platform/administration/legacy/ScreensRoles.jsx";
import { Permissions, Placeholder } from "../../platform/administration/legacy/ScreensPermissions.jsx";
import { Modules } from "../../platform/administration/legacy/ScreensModules.jsx";
import { RolePermissions, AuditLog, NotificationsPage } from "../../platform/administration/legacy/ScreensMore.jsx";
import { Languages, LanguageText } from "../../platform/administration/legacy/ScreensLang.jsx";
import { EmailTemplates, EmailSent, ReminderSent, CmEmailTemplates } from "../../platform/administration/legacy/ScreensEmail.jsx";
import { LoginScreen, ForgotPasswordScreen, ResetPasswordScreen, MustChangePasswordScreen } from "../../platform/auth/legacy/ScreensAuth.jsx";
import { Dashboard } from "../../platform/dashboard/legacy/Dashboard.jsx";
import { MenuProvider, landingForPermissions, useMenus } from "../../platform/navigation/legacy/MenuData.jsx";
import { Menus } from "../../platform/navigation/legacy/ScreensMenus.jsx";
import { SearchProvider, useSearch } from "../../platform/search/legacy/Search.jsx";
import { SessionProvider, useSession } from "../../platform/session/legacy/Session.jsx";
import { LockScreen, LockWarning, useIdleMonitor } from "../../platform/session/legacy/Lock.jsx";
import { Settings } from "../../platform/settings/legacy/ScreensSettings.jsx";
import { BackgroundProcesses } from "../../platform/administration/legacy/ScreensBackgroundProcesses.jsx";
import { SettingsProvider, useSettings } from "../../platform/settings/legacy/SettingsStore.jsx";
import { NotifProvider } from "../../platform/notifications/legacy/Notifications.jsx";
import { VendorRegister } from "../../modules/vendor-workspace/legacy/VendorRegister.jsx";
import { ScreenErrorBoundary } from "../../shared/legacy/ErrorBoundary.jsx";
import { Spinner, ToastProvider } from "../../shared/legacy/PrimitivesX.jsx";
import { ThemeProvider, useC } from "../../shared/legacy/Tokens.jsx";
import { I18nProvider, useI18n } from "../../shared/legacy/i18n.jsx";
import { TweaksRoot, AppTweaksPanel } from "../../shared/legacy/Tweaks.jsx";
import { pathForRoute, routeFromPath } from "./routes.js";

const CONTENT_MAX_COMFORT = 2560;

const DENSE_ROUTES = new Set([
  "vendor", "vendorApproval", "vendorInvitation", "vendorImport",
  "trackerProposals", "trackerOverdue", "cipWorkflow",
  "cmDatabase", "cmExpiry", "reminderSent", "cmImport", "cmMaterialSync",
  "cipRepository",
  "users", "roles", "rolePermissions", "audit", "emailSent", "vendorContacts",
  "adminRegions", "commodity", "kbli", "vendorStatus", "vendorWorkflow",
]);

function contentWidthFor(route) {
  return DENSE_ROUTES.has(route) ? "none" : CONTENT_MAX_COMFORT;
}

function TITLE(route, t) {
  return ({
    dashboard: t("nav.dashboard"), modules: t("nav.modules"), permissions: t("nav.permissions"), menus: t("nav.menus"),
    languages: t("nav.languages"), languageText: t("nav.languageText"), emailTemplates: t("nav.emailTemplates"),
    cmEmailTemplates: t("nav.emailTemplates"),
    emailSent: t("nav.emailSent"), reminderSent: t("nav.reminderSent"), settings: t("nav.settings"), backgroundProcesses: t("nav.backgroundProcesses"), users: t("nav.users"), roles: t("nav.roles"),
    vendorContacts: t("nav.vendorContacts"),
    audit: t("nav.audit"), notifications: t("notifications"), rolePermissions: "Role Permissions", profile: t("profile"),
    changePassword: t("changePassword"), changeImage: t("changeImage"), holiday: t("nav.holiday"),
    trackerStep: t("nav.trackerStep"), trackerMethod: t("nav.trackerMethod"),
    vendorRelationship: t("nav.vendorRelationship"), vendorDocReq: t("nav.vendorDocReq"),
    brand: t("nav.brand"),
    kbli: t("nav.kbli"),
    country: t("nav.country"),
    adminRegions: t("nav.adminRegions"),
    specialRequirement: t("nav.specialRequirement"),
    commodity: t("nav.commodity"),
    vendorStatus: t("nav.vendorStatus"), kbliType: t("nav.kbliType"), kbliStatus: t("nav.kbliStatus"),
    trackerDashboard: t("nav.trackerDashboard"), trackerProposals: t("nav.trackerProposals"),
    trackerOverdue: t("nav.trackerOverdue"),
    vendor: t("nav.vendorDatabase"), vendorInvitation: t("nav.vendorInvitation"), vendorImport: t("nav.vendorImport"),
    cmDashboard: t("nav.contractDashboard"), cmDatabase: t("nav.cmDatabase"), cmExpiry: t("nav.cmExpiry"), cmImport: t("nav.cmImport"), cmMaterialSync: t("nav.cmMaterialSync"),
    vwDashboard: t("nav.vwDashboard"),
    cipDashboard: t("nav.cipDashboard"), cipWorkflow: t("nav.cipWorkflow"), cipTemplates: t("nav.cipTemplates"), cipAuthorization: t("nav.cipAuthorization"),
    cipRepository: t("nav.cipRepository"),
  })[route] || "Alamtri Geo";
}

function Passthrough({ children }) {
  return children;
}

function renderPlatformScreen(route, ctx) {
  const { navigate } = ctx;
  if (route === "dashboard") return <Dashboard onNavigate={navigate} />;
  if (route === "users") return <Users onNavigate={navigate} />;
  if (route === "vendorContacts") return <VendorContacts />;
  if (route === "roles") return <Roles onNavigate={navigate} />;
  if (route === "modules") return <Modules />;
  if (route === "permissions") return <Permissions />;
  if (route === "rolePermissions") return <RolePermissions onNavigate={navigate} />;
  if (route === "languages") return <Languages onNavigate={navigate} />;
  if (route === "languageText") return <LanguageText />;
  if (route === "emailTemplates") return <EmailTemplates />;
  if (route === "cmEmailTemplates") return <CmEmailTemplates />;
  if (route === "emailSent") return <EmailSent />;
  if (route === "reminderSent") return <ReminderSent />;
  if (route === "settings") return <Settings />;
  if (route === "backgroundProcesses") return <BackgroundProcesses onNavigate={navigate} />;
  if (route === "menus") return <Menus />;
  if (route === "audit") return <AuditLog />;
  if (route === "holiday") return <Holiday />;
  if (route === "notifications") return <NotificationsPage />;
  return null;
}

function AppInner({ renderModuleScreen, MasterDataProviders }) {
  const C = useC();
  const { t } = useI18n();
  const session = useSession();
  const { menu } = useMenus();
  const { s } = useSettings();
  const search = useSearch();
  const location = useLocation();
  const routerNavigate = useNavigate();
  const Providers = MasterDataProviders || Passthrough;
  const [regToken] = React.useState(() => { try { return new URLSearchParams(window.location.search).get("invite") || ""; } catch (e) { return ""; } });
  const [resetLinkToken] = React.useState(() => { try { return new URLSearchParams(window.location.search).get("reset") || ""; } catch (e) { return ""; } });
  const [resetToken, setResetToken] = React.useState(resetLinkToken || null);
  const [phase, setPhase] = React.useState(() => (regToken ? "register" : (resetLinkToken ? "reset" : "checking")));
  const [authUser, setAuthUser] = React.useState(() => { try { return new URLSearchParams(window.location.search).get("email") || ""; } catch (e) { return ""; } });
  const [internalAuthState, setInternalAuthState] = React.useState({ ssoEnabled: false });
  const urlRoute = routeFromPath(location.pathname);
  const landing = landingForPermissions(menu, session.permissions, session.effectiveRoles);
  const route = urlRoute || landing;
  const [collapsed, setCollapsed] = React.useState(false);
  const [locked, setLocked] = React.useState(false);
  const [warn, setWarn] = React.useState(null);
  const mainRef = React.useRef(null);
  const previousRouteRef = React.useRef(route);
  const sessionRef = React.useRef(session);
  const phaseRef = React.useRef(phase);
  const contentMaxWidth = contentWidthFor(route);
  const caseArg = new URLSearchParams(location.search).get("case");

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const resolveInternalUser = React.useCallback((authState) => {
    if (!authState) return null;
    const personnelNo = (authState.personnelNo || authState.actorId || "").trim().toUpperCase();
    const backendRoles = Array.isArray(authState.roles) ? authState.roles.filter(Boolean) : [];
    const backendPermissions = Array.isArray(authState.permissions) ? authState.permissions.filter(Boolean) : [];
    const backendUser = authState.user || null;
    const buildBackendResolvedUser = (seedUser) => ({
      id: seedUser?.id || 0,
      personnelNo: personnelNo || backendUser?.personnelNo || "",
      avatar: authState.avatarUrl || null,
      permissions: backendPermissions,
      fullName: backendUser?.fullName || authState.displayName || authState.sessionDisplayName || seedUser?.fullName || seedUser?.name || "Internal User",
      name: backendUser?.fullName || authState.displayName || authState.sessionDisplayName || seedUser?.fullName || seedUser?.name || "Internal User",
      username: backendUser?.username || seedUser?.username || personnelNo || "",
      email: backendUser?.email || seedUser?.email || "",
      status: backendUser?.status || seedUser?.status || "Active",
      reportTo: seedUser?.reportTo || "",
      role: backendRoles[0] || seedUser?.role || "Basic",
      roles: backendRoles.length > 0 ? backendRoles : (seedUser?.roles || (seedUser?.role ? [seedUser.role] : ["Basic"])),
      hasLocalPassword: !!authState.hasLocalPassword,
      mustChangePassword: !!authState.mustChangePassword,
    });

    if (personnelNo) {
      if (backendUser) return buildBackendResolvedUser(null);
    }
    if (backendUser) return buildBackendResolvedUser(null);

    const displayName = (authState.displayName || authState.sessionDisplayName || "").trim().toLowerCase();
    if (!displayName || !backendUser) return null;
    return buildBackendResolvedUser(null);
  }, []);

  const goLanding = React.useCallback((permissions, roles) => {
    const key = landingForPermissions(menu, permissions, roles);
    routerNavigate(pathForRoute(key), { replace: true });
  }, [menu, routerNavigate]);

  React.useEffect(() => {
    if (regToken) return;
    if (phase !== "checking") return;

    let cancelled = false;
    const authApi = window.__internalAuth;
    if (!authApi || typeof authApi.me !== "function") {
      setPhase("login");
      return;
    }

    authApi.me()
      .then(async (authState) => {
        if (cancelled) return;
        setInternalAuthState(authState || { ssoEnabled: false });

        const internalUser = resolveInternalUser(authState);
        if ((authState?.actorType || "").toLowerCase() === "internal" && authState?.personnelNo && internalUser) {
          await window.__procurementStorage?.hydrate?.(internalUser.permissions || []);
          if (cancelled) return;
          sessionRef.current.login(internalUser);
          setAuthUser(internalUser.email || internalUser.username || "");
          if (authState.mustChangePassword) {
            setPhase("must-change-password");
            return;
          }
          if (!routeFromPath(window.location.pathname)) {
            goLanding(internalUser.permissions || [], internalUser.roles);
          }
          setPhase("app");
          return;
        }

        sessionRef.current.logout();
        setAuthUser("");
        if (authState?.ssoEnabled && typeof authApi.startSso === "function") {
          authApi.startSso();
          return;
        }
        setPhase("login");
      })
      .catch(() => {
        if (cancelled) return;
        sessionRef.current.logout();
        setAuthUser("");
        setPhase("login");
      });

    return () => { cancelled = true; };
  }, [goLanding, phase, regToken, resolveInternalUser]);

  React.useEffect(() => {
    if (phase !== "app") return;
    const key = routeFromPath(location.pathname);
    if (!key) {
      if (session.isImpersonating && !(session.permissions && session.permissions.length)) return;
      goLanding(session.permissions, session.effectiveRoles);
      return;
    }
    const canonical = pathForRoute(key);
    const clean = location.pathname.replace(/\/+$/, "") || "/";
    if (clean !== canonical) {
      routerNavigate(`${canonical}${location.search || ""}`, { replace: true });
    }
  }, [phase, location.pathname, location.search, session.isImpersonating, session.permissions, session.effectiveRoles, goLanding, routerNavigate]);

  React.useEffect(() => {
    const previousRoute = previousRouteRef.current;
    if (route === "vendor") {
      setCollapsed(true);
    } else if (previousRoute === "vendor") {
      setCollapsed(false);
    }
    previousRouteRef.current = route;
  }, [route]);

  const navigate = (key, arg) => {
    if (key === "logout") {
      const resumeSso = !!internalAuthState.ssoEnabled;
      Promise.resolve(window.__internalAuth?.logout?.()).catch(() => null).then(() => {
        session.logout();
        setAuthUser("");
        if (resumeSso && typeof window.__internalAuth?.startSso === "function") {
          setPhase("checking");
          window.__internalAuth.startSso();
          return;
        }
        setPhase("login");
        routerNavigate("/", { replace: true });
      });
      return;
    }
    if (key === "landing") {
      routerNavigate("/", { replace: true });
      if (mainRef.current) mainRef.current.scrollTop = 0;
      return;
    }
    const path = pathForRoute(key);
    const caseId = arg == null ? "" : (typeof arg === "object" ? String(arg.id || arg.caseId || "") : String(arg));
    routerNavigate(caseId ? `${path}?case=${encodeURIComponent(caseId)}` : path);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };

  React.useEffect(() => {
    const onExpired = () => {
      if (phaseRef.current === "login" || phaseRef.current === "checking") return;
      const resumeSso = !!internalAuthState.ssoEnabled;
      Promise.resolve(window.__internalAuth?.logout?.()).catch(() => null).then(() => {
        sessionRef.current.logout();
        setAuthUser("");
        if (resumeSso && typeof window.__internalAuth?.startSso === "function") {
          setPhase("checking");
          window.__internalAuth.startSso();
          return;
        }
        setPhase("login");
        routerNavigate("/", { replace: true });
      });
    };
    window.addEventListener("ag:session-expired", onExpired);
    return () => window.removeEventListener("ag:session-expired", onExpired);
  }, [internalAuthState.ssoEnabled, routerNavigate]);

  React.useEffect(() => {
    if (phase !== "login" || !internalAuthState.ssoEnabled) return;
    if (typeof window.__internalAuth?.startSso === "function") {
      window.__internalAuth.startSso();
    }
  }, [phase, internalAuthState.ssoEnabled]);

  const onAuthenticated = async (credentials) => {
    const identifierRaw = typeof credentials === "string" ? credentials : (credentials && credentials.identifier);
    const password = typeof credentials === "string" ? "" : (credentials && credentials.password);
    const raw = (identifierRaw || authUser || "").trim();
    const identifier = raw.includes("@") ? raw.toLowerCase() : raw;
    if (!identifier || !password) {
      throw new Error("Enter your personnel number or email and password.");
    }

    await window.__internalAuth.login(identifier, password);
    const authState = await window.__internalAuth.me();
    const resolved = resolveInternalUser(authState);
    if (!resolved) {
      throw new Error("Your internal user profile could not be loaded. Please contact an administrator.");
    }
    await window.__procurementStorage?.hydrate?.(resolved.permissions || []);
    session.login(resolved);
    setInternalAuthState(authState || { ssoEnabled: false });
    setAuthUser(resolved.email || resolved.username || "");
    if (authState?.mustChangePassword) {
      setPhase("must-change-password");
      return;
    }
    goLanding(resolved.permissions || [], resolved.roles);
    setPhase("app");
  };

  const handleRequestReset = async (identifier) => {
    const result = await window.__internalAuth.requestPasswordReset(identifier);
    setResetToken(result && result.resetToken ? result.resetToken : null);
    setAuthUser(identifier);
    return result;
  };

  const handleConfirmReset = async (newPassword) => {
    await window.__internalAuth.confirmPasswordReset(authUser, resetToken, newPassword);
  };

  const onClearWarn = React.useCallback(() => setWarn((w) => (w == null ? w : null)), []);
  const onTimeout = React.useCallback(() => { setWarn(null); if (s.lockScreen) setLocked(true); else navigate("logout"); }, [s.lockScreen]);
  useIdleMonitor({
    enabled: phase === "app" && s.sessionEnabled && !locked,
    timeoutSec: Math.max(10, Number(s.timeout) || 240),
    countdownSec: Math.max(5, Number(s.countdown) || 20),
    locked,
    onWarn: setWarn, onClearWarn, onTimeout,
  });
  const lockNow = () => { setWarn(null); setLocked(true); };
  const cipAuthRoles = session.effectiveRoles || [session.effectiveRole];
  const cipAuthPerms = session.permissions || [];
  const canAccessCipAuthorization = cipAuthRoles.some((r) => r === "Super Admin" || r === "Administrator Proposal Tracker")
    || cipAuthPerms.includes("masterData.cipAuthorization.manage")
    || cipAuthPerms.includes("masterData.contractInitiationPlatform.manage");
  const screenCtx = {
    navigate,
    navArg: caseArg,
    onConsumeInitial: () => routerNavigate(location.pathname, { replace: true }),
    canAccessCipAuthorization,
  };

  if (phase === "register") return <VendorRegister initialToken={regToken} onBack={() => setPhase("login")} onDone={() => setPhase("login")} />;
  if (phase === "checking" || (phase === "login" && internalAuthState.ssoEnabled)) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}><Spinner size={22} color={C.ocean} /></div>;
  }
  if (phase === "login") return <LoginScreen onSubmit={(u) => { setAuthUser(typeof u === "string" ? u : (u && u.identifier) || ""); return onAuthenticated(u); }} onSso={() => window.__internalAuth?.startSso?.()} ssoEnabled={false} onForgot={(u) => { setAuthUser(u); setPhase("forgot"); }} onRegister={() => setPhase("register")} />;
  if (phase === "must-change-password") return <MustChangePasswordScreen onSignOut={() => navigate("logout")} onDone={async () => {
    const authState = await window.__internalAuth.me();
    const resolved = resolveInternalUser(authState);
    if (resolved) {
      session.login(resolved);
      setInternalAuthState(authState || { ssoEnabled: false });
      goLanding(resolved.permissions || [], resolved.roles);
    }
    setPhase("app");
  }} />;
  if (phase === "forgot") return <ForgotPasswordScreen initialUser={authUser} resetTokenAvailable={!!resetToken} onBack={() => setPhase("login")} onReset={(value) => { setAuthUser(value); setPhase("reset"); }} onRequest={handleRequestReset} />;
  if (phase === "reset") return <ResetPasswordScreen account={authUser} resetToken={resetToken} onBack={() => setPhase("forgot")} onDone={() => { setResetToken(null); setPhase("login"); routerNavigate("/", { replace: true }); }} onSubmitReset={handleConfirmReset} />;

  let Screen = renderPlatformScreen(route, screenCtx);
  if (Screen == null && typeof renderModuleScreen === "function") Screen = renderModuleScreen(route, screenCtx);
  if (Screen == null) Screen = <Placeholder route={route} onNavigate={navigate} />;

  return (
    <Providers>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: C.bg }}>
      <SideNav route={route} onNavigate={navigate} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title={TITLE(route, t)} user={session.actingUser} onNavigate={navigate} onLock={lockNow} ssoEnabled={internalAuthState.ssoEnabled} ssoHomeUrl={internalAuthState.ssoHomeUrl} />
        {session.isImpersonating && <ImpersonationBar onExit={() => navigate(landingForPermissions(menu, session.realUser.permissions || [], session.realUser.roles))} />}
        <main ref={(el) => { mainRef.current = el; if (search) search.scrollRootRef.current = el; }} style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: contentMaxWidth, margin: "0 auto", padding: "24px 28px 56px" }}>
            <ScreenErrorBoundary routeKey={route}>{Screen}</ScreenErrorBoundary>
          </div>
        </main>
      </div>
      {warn != null && !locked && <LockWarning seconds={warn} onStay={() => setWarn(null)} onLockNow={lockNow} />}
      {locked && <LockScreen user={session.realUser} ssoEnabled={internalAuthState.ssoEnabled} ssoHomeUrl={internalAuthState.ssoHomeUrl} onUnlock={() => setLocked(false)} onSignOut={() => { setLocked(false); navigate("logout"); }} />}
    </div>
    </Providers>
  );
}

export function AppShell({ renderModuleScreen, MasterDataProviders }) {
  return (
    <TweaksRoot>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <MenuProvider>
              <SessionProvider>
                <SettingsProvider>
                  <SearchProvider>
                    <NotifProvider>
                      <BrowserRouter>
                        <AppInner renderModuleScreen={renderModuleScreen} MasterDataProviders={MasterDataProviders} />
                        <AppTweaksPanel />
                      </BrowserRouter>
                    </NotifProvider>
                  </SearchProvider>
                </SettingsProvider>
              </SessionProvider>
            </MenuProvider>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </TweaksRoot>
  );
}
