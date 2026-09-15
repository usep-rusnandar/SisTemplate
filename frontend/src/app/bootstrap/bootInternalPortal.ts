import { createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "../../shared/styles/colors-and-type.css";
import "./legacy-shell.css";
import { installApiBackedStorage } from "./apiBackedStorage";
import { installHostGlobals, type AppPortal } from "./legacyRuntime";

type InternalAuthApi = {
  me: () => Promise<any>;
  login: (identifier: string, password: string) => Promise<any>;
  devLogin: (identifier: string) => Promise<any>;
  logout: () => Promise<void>;
  startSso: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
  verifyPassword: (password: string) => Promise<any>;
  passwordPolicy: () => Promise<any>;
  requestPasswordReset: (identifier: string) => Promise<any>;
  confirmPasswordReset: (identifier: string, resetToken: string, newPassword: string) => Promise<any>;
};

async function internalAuthJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error((payload && (payload.title || payload.message || payload.code)) || `Request failed (${response.status})`);
    (error as any).status = response.status;
    (error as any).code = payload && payload.code;
    (error as any).errors = payload && payload.errors;
    throw error;
  }

  return payload;
}

function installInternalAuth() {
  (window as typeof window & { __internalAuth?: InternalAuthApi }).__internalAuth = {
    me: () => internalAuthJson("/api/v1/internal/auth/me"),
    login: (identifier: string, password: string) => internalAuthJson("/api/v1/internal/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    }),
    devLogin: (identifier: string) => internalAuthJson("/api/v1/internal/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    }),
    logout: async () => {
      await internalAuthJson("/api/v1/internal/auth/logout", { method: "POST" });
    },
    startSso: () => {
      window.location.assign("/api/v1/internal/sso/login");
    },
    changePassword: (currentPassword: string, newPassword: string) => internalAuthJson("/api/v1/internal/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
    verifyPassword: (password: string) => internalAuthJson("/api/v1/internal/auth/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),
    passwordPolicy: () => internalAuthJson("/api/v1/internal/auth/password-policy"),
    requestPasswordReset: (identifier: string) => internalAuthJson("/api/v1/internal/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    }),
    confirmPasswordReset: (identifier: string, resetToken: string, newPassword: string) => internalAuthJson("/api/v1/internal/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, resetToken, newPassword }),
    }),
  };
}

function isSafeRelativeReturnPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.includes("://");
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length >= 3;
}

/** PIC / Suite may land on /?token=JWT. Consume it through AppHost before the SPA renders. */
function consumeVisibleSsoToken(): boolean {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token || !looksLikeJwt(token)) {
    return false;
  }

  url.searchParams.delete("token");
  const returnPath = `${url.pathname}${url.search}${url.hash}`;
  const safeReturn = isSafeRelativeReturnPath(returnPath) ? returnPath : "/";
  const dest = new URL("/api/v1/internal/sso/callback", window.location.origin);
  dest.searchParams.set("token", token);
  dest.searchParams.set("return", safeReturn);
  window.location.replace(`${dest.pathname}${dest.search}`);
  return true;
}

export function bootInternalPortal(portal: AppPortal, App: ComponentType) {
  if (consumeVisibleSsoToken()) {
    return;
  }

  installInternalAuth();
  void (async () => {
    installHostGlobals("internal", portal);
    await installApiBackedStorage("integrated-procurement", { hydrateOnInstall: false });
    const root = document.getElementById("root");
    if (!root) throw new Error(`${portal} portal #root is missing`);
    createRoot(root).render(createElement(App));
  })();
}
