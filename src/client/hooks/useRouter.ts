import { useCallback, useEffect, useState } from "react";

export type Route =
  | { page: "feed" }
  | { page: "block-new" }
  | { page: "block-edit"; blockId: number }
  | {
      page: "action";
      blockUuid: string;
      actionName: string;
      params: Record<string, string>;
    };

function parseRoute(pathname: string, search: string): Route {
  if (pathname === "/blocks/new") {
    return { page: "block-new" };
  }

  const editMatch = pathname.match(/^\/blocks\/(\d+)\/edit$/);
  if (editMatch) {
    return { page: "block-edit", blockId: Number(editMatch[1]) };
  }

  const actionMatch = pathname.match(/^\/action\/([^/]+)\/([^/?]+)/);
  if (actionMatch) {
    const searchParams = new URLSearchParams(search);
    const params: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (k !== "_cid") {
        params[k] = v;
      }
    }
    return {
      page: "action",
      blockUuid: actionMatch[1] ?? "",
      actionName: actionMatch[2] ?? "",
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

  const navigateToNewBlock = useCallback(() => {
    window.history.pushState(null, "", "/blocks/new");
    setRoute({ page: "block-new" });
  }, []);

  const navigateToEditBlock = useCallback((id: number) => {
    window.history.pushState(null, "", `/blocks/${id}/edit`);
    setRoute({ page: "block-edit", blockId: id });
  }, []);

  return { route, navigateHome, navigateToNewBlock, navigateToEditBlock };
}
