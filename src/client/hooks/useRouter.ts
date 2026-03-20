import { useCallback, useEffect, useState } from "react";

export type Route =
  | { page: "feed" }
  | {
      page: "action";
      blockUuid: string;
      actionName: string;
      params: Record<string, string>;
    };

function parseRoute(pathname: string, search: string): Route {
  const match = pathname.match(/^\/action\/([^/]+)\/([^/?]+)/);
  if (match) {
    const searchParams = new URLSearchParams(search);
    const params: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (k !== "_cid") {
        params[k] = v;
      }
    }
    return {
      page: "action",
      blockUuid: match[1] ?? "",
      actionName: match[2] ?? "",
      params,
    };
  }
  return { page: "feed" };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );

  // Listen for popstate (browser back/forward)
  useEffect(() => {
    function handlePopState() {
      setRoute(parseRoute(window.location.pathname, window.location.search));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Intercept action link clicks for client-side navigation
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest(
        "a[data-action-link]",
      ) as HTMLAnchorElement | null;
      if (!target) return;
      e.preventDefault();
      const href = target.getAttribute("href");
      if (!href) return;
      window.history.pushState(null, "", href);
      setRoute(
        parseRoute(
          new URL(href, window.location.origin).pathname,
          new URL(href, window.location.origin).search,
        ),
      );
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const navigateHome = useCallback(() => {
    window.history.pushState(null, "", "/");
    setRoute({ page: "feed" });
  }, []);

  return { route, navigateHome };
}
