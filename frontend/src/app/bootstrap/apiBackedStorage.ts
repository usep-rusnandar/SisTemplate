type FrontendStateItem = {
  key: string;
  value: string;
};

type FrontendStateListResponse = {
  items?: FrontendStateItem[];
};

type PendingWrite = {
  action: "delete" | "put";
  value?: string;
  timerId: number;
};

type DomainStorageRoute = {
  prefix: string;
  endpoint: string;
  /** Module view key that authorizes GET/PUT/DELETE on this route. Missing = always allowed. */
  viewPermission?: string | string[];
};

const bridgeStateEndpoint = "/api/v1/frontend-state";

// Domain-scoped storage lives behind INTERNAL module permissions (proposalTracker.view, …), so only the
// internal console should hydrate/flush them. The external vendor bundle passes an empty set — a vendor
// principal can never satisfy those permissions, so hydrating them there only produced permanent 401 noise.
const internalDomainStorageRoutes: DomainStorageRoute[] = [
  { prefix: "ag_tracker_", endpoint: "/api/v1/proposal-tracker/storage", viewPermission: "proposalTracker.view" },
  { prefix: "ag_cip_", endpoint: "/api/v1/contract-initiation-platform/storage", viewPermission: ["contractInitiationPlatform.view", "proposalTracker.view"] },
  { prefix: "ag_cm_", endpoint: "/api/v1/contract-monitoring/storage", viewPermission: "contractMonitoring.view" },
];

export type ApiBackedStorageOptions = {
  /** Domain-scoped storage routes to hydrate/flush. Defaults to the internal module set. Pass [] for
   *  bundles (e.g. the vendor portal) whose principal has no internal module permissions. */
  domainRoutes?: DomainStorageRoute[];
  /** Whether to hydrate immediately on install. Defaults to true (the vendor bundle relies on it).
   *  The internal console passes false: it hydrates via App.jsx only AFTER login, so nothing
   *  auth-scoped fires against a logged-out session (avoids benign 401 console noise). */
  hydrateOnInstall?: boolean;
};

export class ProcurementApiStorage {
  private readonly cache = new Map<string, string>();
  private readonly pendingWrites = new Map<string, PendingWrite>();
  private readonly hydratedDomainKeys = new Set<string>();
  private readonly scope: string;
  private readonly domainStorageRoutes: DomainStorageRoute[];
  private permissions = new Set<string>();
  // Backend persistence is authorized only within an authenticated session. Until hydrate() runs
  // (which App.jsx invokes AFTER login), the store operates purely in-memory: reads/writes stay in
  // the cache and no fetch reaches the backend, so a logged-out page produces no 401 noise.
  private authenticated = false;
  private sessionExpiredNotified = false;
  private readonly authListeners = new Set<() => void>();

  constructor(scope: string, domainRoutes: DomainStorageRoute[] = internalDomainStorageRoutes) {
    this.scope = scope;
    this.domainStorageRoutes = domainRoutes;
  }

  get length() {
    return this.cache.size;
  }

  /** True once an authenticated session exists (hydrate() has been called). Consumers that make
   *  their own auth-scoped calls (e.g. MenuData's /super-admin/menu-tree) gate on this + onAuthenticated. */
  get isAuthenticated() {
    return this.authenticated;
  }

  /** Subscribe to the logged-out → authenticated transition. Fires once when hydrate() first runs.
   *  Returns an unsubscribe function. If already authenticated, the callback is invoked immediately. */
  onAuthenticated(listener: () => void) {
    if (this.authenticated) {
      listener();
      return () => {};
    }
    this.authListeners.add(listener);
    return () => this.authListeners.delete(listener);
  }

  private markAuthenticated() {
    if (this.authenticated) return;
    this.authenticated = true;
    for (const listener of this.authListeners) {
      try { listener(); } catch { /* listener errors must not break hydration */ }
    }
    this.authListeners.clear();
  }

  /** Server session is gone (wipe, idle timeout, SSO cookie lost). Tell the shell to return to login. */
  private notifySessionExpired() {
    if (this.sessionExpiredNotified) return;
    this.sessionExpiredNotified = true;
    this.authenticated = false;
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("ag:session-expired"));
  }

  private handleUnauthorized(response: Response) {
    if (response.status !== 401) return false;
    this.notifySessionExpired();
    return true;
  }

  /** True if the hydrated principal holds this permission key (from /auth/me). */
  canPermission(key: string) {
    return this.permissions.has(key);
  }

  async hydrate(permissions?: string[] | null) {
    // Apply RBAC before markAuthenticated so onAuthenticated listeners (menu-tree, …) can skip
    // Super-Admin-only calls. Domain routes are skipped unless the principal has the module view key —
    // otherwise Chrome logs a 403 for every GET/PUT/DELETE even when we swallow the response.
    // Calling hydrate() without a permissions argument must NOT clear the session set — Contract
    // Database used to do that, which skipped domain GET and let a stale bridge copy wipe the register.
    if (Array.isArray(permissions)) {
      this.permissions = new Set(permissions);
    }
    this.sessionExpiredNotified = false;
    this.markAuthenticated();
    await this.hydrateBridgeState();
    await this.hydrateDomainState();
    await this.migrateDomainKeysFromBridgeState();
  }

  private async hydrateBridgeState() {
    try {
      const response = await fetch(`${bridgeStateEndpoint}?scope=${encodeURIComponent(this.scope)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (this.handleUnauthorized(response) || !response.ok) {
        return;
      }

      const payload = (await response.json()) as FrontendStateListResponse;
      for (const item of payload.items ?? []) {
        // Domain keys already loaded from module storage win. A stale frontend-state copy
        // of ag_cm_contracts_v1 (or tracker/CIP stores) must not clobber them.
        if (this.hydratedDomainKeys.has(item.key)) continue;
        this.cache.set(item.key, item.value);
      }
    } catch (error) {
      console.warn("Backend bridge state API is not reachable yet; starting with seed data.", error);
    }
  }

  private canUseDomainRoute(route: DomainStorageRoute | null) {
    if (!route) return true;
    if (!route.viewPermission) return true;
    const keys = Array.isArray(route.viewPermission) ? route.viewPermission : [route.viewPermission];
    return keys.some((key) => this.permissions.has(key));
  }

  private async hydrateDomainState() {
    for (const route of this.domainStorageRoutes) {
      if (!this.canUseDomainRoute(route)) continue;
      try {
        const response = await fetch(route.endpoint, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (this.handleUnauthorized(response) || !response.ok) {
          continue;
        }

        const payload = (await response.json()) as FrontendStateListResponse;
        for (const item of payload.items ?? []) {
          this.cache.set(item.key, item.value);
          this.hydratedDomainKeys.add(item.key);
        }
      } catch (error) {
        console.warn(`Backend domain state API is not reachable for ${route.endpoint}; using available seed data.`, error);
      }
    }
  }

  private async migrateDomainKeysFromBridgeState() {
    const writes: Promise<void>[] = [];
    for (const [key, value] of this.cache.entries()) {
      const route = this.routeForKey(key);
      if (route && this.canUseDomainRoute(route) && !this.hydratedDomainKeys.has(key)) {
        if (this.isEmptyJsonArray(value)) continue;
        writes.push(this.flushWrite(key, "put", value));
      }
    }

    await Promise.allSettled(writes);
  }

  private isEmptyJsonArray(value: string | undefined) {
    if (value == null || String(value).trim() === "") return true;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every((row) => row == null || typeof row !== "object");
    } catch {
      return false;
    }
  }

  private routeForKey(key: string) {
    return this.domainStorageRoutes.find((route) => key.startsWith(route.prefix)) ?? null;
  }

  private endpointForKey(key: string) {
    return this.routeForKey(key)?.endpoint ?? bridgeStateEndpoint;
  }

  private urlForKey(key: string) {
    const encodedKey = encodeURIComponent(key);
    const endpoint = this.endpointForKey(key);
    return endpoint === bridgeStateEndpoint
      ? `${endpoint}/item?key=${encodedKey}&scope=${encodeURIComponent(this.scope)}`
      : `${endpoint}/item?key=${encodedKey}`;
  }

  key(index: number) {
    return Array.from(this.cache.keys()).sort()[index] ?? null;
  }

  getItem(key: string) {
    return this.cache.get(String(key)) ?? null;
  }

  /** Re-fetch one KV item from the server. Used when a popup opens so notes/docs are not stuck
   *  on the login-time hydrate snapshot. Network errors leave the existing cache in place. */
  async refreshItem(key: string) {
    if (!this.authenticated) return;
    const normalizedKey = String(key);
    if (!this.canUseDomainRoute(this.routeForKey(normalizedKey))) return;
    if (this.pendingWrites.has(normalizedKey)) return;
    try {
      const response = await fetch(this.urlForKey(normalizedKey), {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (response.status === 404) {
        this.cache.delete(normalizedKey);
        this.hydratedDomainKeys.delete(normalizedKey);
        return;
      }

      if (this.handleUnauthorized(response) || !response.ok) {
        return;
      }

      const payload = (await response.json()) as FrontendStateItem;
      if (typeof payload?.value === "string") {
        this.cache.set(normalizedKey, payload.value);
        this.hydratedDomainKeys.add(normalizedKey);
      }
    } catch (error) {
      console.warn("Backend state API refresh failed; in-memory cache remains active.", error);
    }
  }

  setItem(key: string, value: string) {
    const normalizedKey = String(key);
    const normalizedValue = String(value);
    this.cache.set(normalizedKey, normalizedValue);
    this.queueWrite(normalizedKey, "put", normalizedValue);
  }

  removeItem(key: string) {
    const normalizedKey = String(key);
    this.cache.delete(normalizedKey);
    this.queueWrite(normalizedKey, "delete");
  }

  clear() {
    this.cache.clear();
    for (const pending of this.pendingWrites.values()) {
      window.clearTimeout(pending.timerId);
    }
    this.pendingWrites.clear();
    void this.flushClear();
  }

  private queueWrite(key: string, action: PendingWrite["action"], value?: string) {
    const existing = this.pendingWrites.get(key);
    if (existing) {
      window.clearTimeout(existing.timerId);
    }

    const timerId = window.setTimeout(() => {
      this.pendingWrites.delete(key);
      void this.flushWrite(key, action, value).catch(() => {});
    }, 150);

    this.pendingWrites.set(key, { action, value, timerId });
  }

  /** Await in-flight module-state PUTs so domain commands (complete) see projected activities. */
  async flushPendingWrites() {
    const pending = Array.from(this.pendingWrites.entries());
    this.pendingWrites.clear();
    await Promise.all(pending.map(async ([key, item]) => {
      window.clearTimeout(item.timerId);
      await this.flushWrite(key, item.action, item.value);
    }));
    if (this.pendingWrites.size) {
      const leftover = Array.from(this.pendingWrites.entries());
      this.pendingWrites.clear();
      await Promise.all(leftover.map(async ([key, item]) => {
        window.clearTimeout(item.timerId);
        await this.flushWrite(key, item.action, item.value);
      }));
    }
  }

  private async flushWrite(key: string, action: PendingWrite["action"], value?: string) {
    // Pre-login the store is in-memory only; skip the network so a logged-out session logs no 401s.
    if (!this.authenticated) return;
    if (!this.canUseDomainRoute(this.routeForKey(key))) return;
    try {
      const response = await fetch(this.urlForKey(key), {
        method: action === "put" ? "PUT" : "DELETE",
        credentials: "include",
        headers: action === "put" ? { "Content-Type": "application/json" } : undefined,
        body: action === "put" ? JSON.stringify({ value }) : undefined,
      });
      if (this.handleUnauthorized(response)) {
        throw new Error(`Backend state API ${action} failed (401).`);
      }
      if (!response.ok) {
        throw new Error(`Backend state API ${action} failed (${response.status}).`);
      }
    } catch (error) {
      console.warn("Backend state API write failed; in-memory state remains active.", error);
      throw error;
    }
  }

  private async flushClear() {
    if (!this.authenticated) return;
    try {
      await fetch(`${bridgeStateEndpoint}?scope=${encodeURIComponent(this.scope)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await Promise.allSettled(this.domainStorageRoutes
        .filter((route) => this.canUseDomainRoute(route))
        .map((route) =>
          fetch(route.endpoint, {
            method: "DELETE",
            credentials: "include",
          })));
    } catch (error) {
      console.warn("Backend state API clear failed; in-memory state remains active.", error);
    }
  }
}

declare global {
  interface Window {
    __procurementStorage: ProcurementApiStorage;
  }
}

export async function installApiBackedStorage(scope: string, options?: ApiBackedStorageOptions) {
  const storage = new ProcurementApiStorage(scope, options?.domainRoutes);
  Object.defineProperty(window, "__procurementStorage", {
    configurable: true,
    value: storage,
  });
  if (options?.hydrateOnInstall ?? true) {
    await storage.hydrate();
  }
}
