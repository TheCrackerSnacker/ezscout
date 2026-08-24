import { useEffect, useState } from "react";

export type Route = { page: "home" } | { page: "form"; formId: string };

const FORM_ROUTE_PATTERN = /^#\/form\/([0-9a-fA-F-]{36})$/;

function parseHash(hash: string): Route {
  const match = FORM_ROUTE_PATTERN.exec(hash);
  return match?.[1] ? { page: "form", formId: match[1] } : { page: "home" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash)
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
