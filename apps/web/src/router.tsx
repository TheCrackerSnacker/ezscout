import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

export type Route =
  | { page: "home" }
  | { page: "form"; formId: string }
  | { page: "admin" }
  | { page: "admin-new" }
  | { page: "admin-edit"; formId: string };

const FORM_PATH_PATTERN = /^\/form\/([0-9a-fA-F-]{36})$/;
const ADMIN_EDIT_PATTERN = /^\/admin\/edit\/([0-9a-fA-F-]{36})$/;

function parsePath(pathname: string): Route {
  if (pathname === "/admin" || pathname === "/admin/") {
    return { page: "admin" };
  }
  if (pathname === "/admin/new") {
    return { page: "admin-new" };
  }
  const editMatch = ADMIN_EDIT_PATTERN.exec(pathname);
  if (editMatch?.[1]) {
    return { page: "admin-edit", formId: editMatch[1] };
  }
  const formMatch = FORM_PATH_PATTERN.exec(pathname);
  return formMatch?.[1]
    ? { page: "form", formId: formMatch[1] }
    : { page: "home" };
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
