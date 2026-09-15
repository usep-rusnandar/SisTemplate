// Side-effect import: converted modules still publish to window so remaining
// Babel classic scripts (Suite Portal business screens + App.jsx) can resolve them as globals.
import "../../shared/legacy/Tokens.jsx";
import "../../shared/legacy/tweaks-panel.jsx";
import "../../shared/legacy/Tweaks.jsx";
import "../../shared/legacy/i18n.jsx";
import "../../shared/legacy/Primitives.jsx";
import "../../shared/legacy/PrimitivesX.jsx";
import "../../shared/legacy/ErrorBoundary.jsx";
import "../../platform/data/legacy/Data.jsx";
import "../../platform/navigation/legacy/MenuData.jsx";
import "../../platform/session/legacy/Session.jsx";
import "../../platform/notifications/legacy/Notifications.jsx";
import "../../platform/search/legacy/Search.jsx";
import "../../platform/settings/legacy/SettingsStore.jsx";
import "../../platform/session/legacy/Lock.jsx";
import "../../platform/account/legacy/AccountModals.jsx";
import "../../platform/about/legacy/AboutApplication.jsx";
import "../shell/legacy/Shell.jsx";
import "../../platform/auth/legacy/ScreensAuth.jsx";
import "../../platform/dashboard/legacy/Dashboard.jsx";
import "../../platform/administration/legacy/ScreensUsers.jsx";
import "../../platform/administration/legacy/ScreensVendorContacts.jsx";
import "../../platform/administration/legacy/ScreensRoles.jsx";
import "../../platform/administration/legacy/ScreensPermissions.jsx";
import "../../platform/administration/legacy/ScreensModules.jsx";
import "../../platform/administration/legacy/ScreensMore.jsx";
import "../../platform/administration/legacy/ScreensHoliday.jsx";
import "../../platform/administration/legacy/ScreensLang.jsx";
import "../../platform/administration/legacy/ScreensEmail.jsx";
import "../../platform/settings/legacy/ScreensSettings.jsx";
import "../../platform/navigation/legacy/ScreensMenus.jsx";
import "../../modules/vendor-workspace/legacy/VendorOnboardingData.jsx";
import "../../modules/vendor-workspace/legacy/VendorRegister.jsx";
import "../../modules/vendor-workspace/legacy/VendorWorkspaceScreens.jsx";

export function publishSharedLegacyModules() {
  // import above is the publish
}
