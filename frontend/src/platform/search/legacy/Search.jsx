/* fm2-converted */
import React from "react";
/* Alamtri Geo Admin — shared page search.
   One query value is shared between a page's in-page search (in the table header)
   and the top-bar search. Only one is visible at a time: the in-page search shows
   while it's scrolled into view; once it scrolls away, the top-bar search takes
   over — pre-filled with the same value. If the user is typing when the swap
   happens, focus (and caret) carries over to whichever input becomes visible. */

const SearchCtx = React.createContext(null);

function SearchProvider({ children }) {
  const [query, setQuery] = React.useState("");
  const [placeholder, setPlaceholder] = React.useState("Search");
  const [hasPageSearch, setHasPageSearch] = React.useState(false);
  const [pageSearchVisible, setPageVisRaw] = React.useState(true);
  const scrollRootRef = React.useRef(null);

  const focusedRef = React.useRef(false);     // is either search input currently focused
  const pendingFocusRef = React.useRef(false); // carry focus to the input that becomes visible
  const visRef = React.useRef(true);
  const topbarInputRef = React.useRef(null);
  const pageInputRef = React.useRef(null);

  // Capture focus intent at the moment visibility flips (before the old input unmounts).
  const setPageSearchVisible = React.useCallback((vis) => {
    if (visRef.current === vis) return;
    if (focusedRef.current) pendingFocusRef.current = true;
    visRef.current = vis;
    setPageVisRaw(vis);
  }, []);

  // After the swap commits, move focus + caret to the now-visible input.
  React.useLayoutEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const el = (hasPageSearch && !pageSearchVisible) ? topbarInputRef.current : pageInputRef.current;
    if (el) {
      el.focus();
      try { const v = el.value || ""; el.setSelectionRange(v.length, v.length); } catch (e) {}
    }
  }, [pageSearchVisible, hasPageSearch]);

  const markFocus = React.useCallback((v) => { focusedRef.current = v; }, []);

  const api = React.useMemo(() => ({
    query, setQuery, placeholder, setPlaceholder,
    hasPageSearch, setHasPageSearch, pageSearchVisible, setPageSearchVisible,
    scrollRootRef, topbarVisible: hasPageSearch && !pageSearchVisible,
    topbarInputRef, pageInputRef, markFocus,
  }), [query, placeholder, hasPageSearch, pageSearchVisible, setPageSearchVisible, markFocus]);
  return <SearchCtx.Provider value={api}>{children}</SearchCtx.Provider>;
}
function useSearch() { return React.useContext(SearchCtx); }

/* Call inside a screen to register its in-page search. Returns the shared
   { query, setQuery } plus a `ref` to attach to the in-page search wrapper —
   when that element scrolls out of the content viewport, the top-bar search
   appears in its place (carrying the same query) — and `inputRef` / focus
   handlers to attach to the in-page <TextInput> so focus transfers on swap. */
function usePageSearch(placeholder) {
  const ctx = useSearch();
  const ref = React.useRef(null);
  React.useEffect(() => {
    ctx.setHasPageSearch(true);
    ctx.setPlaceholder(placeholder || "Search");
    ctx.setPageSearchVisible(true);
    return () => { ctx.setHasPageSearch(false); ctx.setQuery(""); ctx.setPageSearchVisible(true); };
    // eslint-disable-next-line
  }, [placeholder]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => ctx.setPageSearchVisible(entries[0].isIntersecting),
      { root: ctx.scrollRootRef.current || null, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line
  }, [ctx.scrollRootRef.current]);
  return {
    query: ctx.query, setQuery: ctx.setQuery, ref,
    inputRef: ctx.pageInputRef,
    onFocus: () => ctx.markFocus(true),
    onBlur: () => ctx.markFocus(false),
  };
}

Object.assign(window, { SearchProvider, useSearch, usePageSearch });
export { SearchProvider, useSearch, usePageSearch };
