import { useState } from "react";
import { ApiError, login } from "../api";
import type { Route } from "../router";
import { FormEditorPage } from "./FormEditorPage";
import { FormsListPage } from "./FormsListPage";

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

export function AdminPage({
  route,
  authenticated,
  onLogin
}: {
  route: Route;
  authenticated: boolean;
  onLogin: () => void;
}) {
  if (!authenticated) {
    return <LoginCard onSuccess={onLogin} />;
  }

  if (route.page === "admin") return <FormsListPage />;
  if (route.page === "admin-new") return <FormEditorPage />;
  if (route.page === "admin-edit") {
    return <FormEditorPage key={route.formId} formId={route.formId} />;
  }
  return null;
}
