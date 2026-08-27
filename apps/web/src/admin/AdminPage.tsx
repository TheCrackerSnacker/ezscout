import { useEffect, useState } from "react";
import { ApiError, fetchSession, login, logout } from "../api";
import type { Route } from "../router";
import { Link } from "../router";
import { FormEditorPage } from "./FormEditorPage";
import { FormsListPage } from "./FormsListPage";

type AuthState =
  | { phase: "checking" }
  | { phase: "login" }
  | { phase: "ready" };

function LoginCard({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch (caught) {
      setError(
        caught instanceof ApiError &&
          caught.status !== 401 &&
          caught.status !== 403 &&
          caught.detail
          ? `Sign-in failed. ${caught.detail}`
          : "Sign-in failed. Check the admin password."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="card admin-login"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <h2>Admin sign-in</h2>
      <input
        type="password"
        aria-label="Admin password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="submit" disabled={busy || password === ""}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export function AdminPage({ route }: { route: Route }) {
  const [auth, setAuth] = useState<AuthState>({ phase: "checking" });

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((session) => {
        if (!cancelled) {
          setAuth(
            session.authenticated ? { phase: "ready" } : { phase: "login" }
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAuth({ phase: "login" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await logout();
    setAuth({ phase: "login" });
  };

  if (auth.phase === "checking") {
    return (
      <main>
        <p>Checking session…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>EZScout Admin</h1>
      <p>
        <Link to="/">← Home</Link>
        {auth.phase === "ready" ? (
          <>
            {" · "}
            <Link to="/admin">Forms</Link>
            {" · "}
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </>
        ) : null}
      </p>

      {auth.phase === "login" ? (
        <LoginCard onSuccess={() => setAuth({ phase: "ready" })} />
      ) : route.page === "admin" ? (
        <FormsListPage />
      ) : route.page === "admin-new" ? (
        <FormEditorPage />
      ) : route.page === "admin-edit" ? (
        <FormEditorPage key={route.formId} formId={route.formId} />
      ) : null}
    </main>
  );
}
