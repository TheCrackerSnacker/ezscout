import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

export type Route =
  | { page: "home" }
  | { page: "form"; formId: string }
  | { page: "admin" };

const FORM_PATH_PATTERN = /^\/form\/([0-9a-fA-F-]{36})$/;

function parsePath(pathname: string): Route {
  if (pathname === "/admin") {
    return { page: "admin" };
  }
  const match = FORM_PATH_PATTERN.exec(pathname);
  return match?.[1] ? { page: "form", formId: match[1] } : { page: "home" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parsePath(window.location.pathname)
  );

  useEffect(() => {
    const onPopState = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return route;
}

/** pushState does not fire popstate itself, so dispatch one to notify listeners. */
export function navigate(to: string): void {
  if (window.location.pathname === to) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

interface LinkProps {
  to: string;
  children: ReactNode;
}

export function Link({ to, children }: LinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  );
}
