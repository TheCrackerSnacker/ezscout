import { useEffect, useState } from "react";
import { FormLoader } from "./components/FormLoader";
import { PublicFormsList } from "./components/PublicFormsList";
import { AdminPage } from "./admin/AdminPage";
import { Link, navigate, useRoute } from "./router";
import { OfflineIndicator } from "./offline/OfflineIndicator";
import { fetchSession, logout } from "./api";

const ADMIN_PAGES = new Set(["admin", "admin-new", "admin-edit"]);

type AuthState = "checking" | "out" | "in";

export default function App() {
  const route = useRoute();
  const [auth, setAuth] = useState<AuthState>("checking");

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((session) => {
        if (!cancelled) setAuth(session.authenticated ? "in" : "out");
      })
      .catch(() => {
        if (!cancelled) setAuth("out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = () => setAuth("in");

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setAuth("out");
      navigate("/");
    }
  };

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-inner">
          <Link to="/" className="brand">
            <img src="/icon-192.png" alt="" width={30} height={30} />
            EZScout
          </Link>
          <div className="top-bar-right">
            <OfflineIndicator />
            {auth === "in" ? (
              <button
                type="button"
                className="auth-button"
                onClick={() => void handleLogout()}
              >
                Logout
              </button>
            ) : (
              <button
                type="button"
                className="auth-button"
                onClick={() => navigate("/admin")}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

<nav className="menu">
          <div className="menu-inner">
            <Link to="/">Home</Link>
            {auth === "in" ? <Link to="/admin">Manage Forms</Link> : null}
          </div>
        </nav>

      {auth === "checking" ? (
        <main>
          <p>Loading…</p>
        </main>
      ) : (
        <main>
          {route.page === "home" ? <PublicFormsList /> : null}
          {route.page === "form" ? (
            <FormLoader key={route.formId} formId={route.formId} />
          ) : null}
          {ADMIN_PAGES.has(route.page) ? (
            <AdminPage
              route={route}
              authenticated={auth === "in"}
              onLogin={handleLogin}
            />
          ) : null}
        </main>
      )}
    </div>
  );
}