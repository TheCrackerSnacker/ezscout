import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  fetchAdminForms,
  fetchSession,
  login,
  logout,
  publishForm,
  uploadDefinition,
  type AdminFormSummary
} from "../api";
import { Link } from "../router";
import { parseDraft } from "./parseDraft";

type PageState =
  | { phase: "checking" }
  | { phase: "login" }
  | { phase: "ready" };

const NEW_FORM_TARGET = "__new__";

function LoginCard({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    setError(false);
    try {
      await login(password);
      onSuccess();
    } catch {
      setError(true);
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
      {error ? (
        <p role="alert">Sign-in failed. Check the admin password.</p>
      ) : null}
    </form>
  );
}

interface UploaderProps {
  forms: AdminFormSummary[];
  target: string;
  onTargetChange: (target: string) => void;
  onPublished: (result: {
    formId: string;
    version: number;
    isNew: boolean;
  }) => void;
}

function Uploader({
  forms,
  target,
  onTargetChange,
  onPublished
}: UploaderProps) {
  const [draftText, setDraftText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseDraft(draftText), [draftText]);

  const loadFile = async (file: File) => {
    setFileName(file.name);
    setDraftText(await file.text());
    setError(null);
  };

  const handlePublish = async () => {
    if (!parsed.ok) return;
    setBusy(true);
    setError(null);
    try {
      const isNew = target === NEW_FORM_TARGET;
      const uploaded = await uploadDefinition(
        parsed.definition,
        isNew ? undefined : target
      );
      const published = await publishForm(uploaded.id);
      onPublished({
        formId: published.id,
        version: published.version,
        isNew
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? "Your session expired — reload the page and sign in again."
          : "Upload failed. Verify the server is reachable and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="uploader card">
      <h2>Upload a form definition</h2>
      <p className="row">
        <label className="file-label">
          {fileName ? `Loaded ${fileName}` : "Choose JSON file"}
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Form definition file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
        </label>
      </p>

      <textarea
        aria-label="Form definition JSON"
        placeholder='{"title": "...", "questions": [...]}'
        value={draftText}
        onChange={(event) => {
          setFileName(null);
          setDraftText(event.target.value);
        }}
      />

      {!parsed.ok && draftText.trim() !== "" ? (
        <div className="issues" role="alert">
          <p>{parsed.message}</p>
          {parsed.issues.length > 0 ? (
            <ul>
              {parsed.issues.map((issue, index) => (
                <li key={index}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {parsed.ok ? (
        <div className="preview">
          <h3>
            Valid: "{parsed.definition.title}" —{" "}
            {parsed.definition.questions.length} question(s)
          </h3>
          <div className="row">
            <label>
              Publish as{" "}
              <select
                aria-label="Publish target"
                value={target}
                onChange={(event) => onTargetChange(event.target.value)}
              >
                <option value={NEW_FORM_TARGET}>a new form</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    new version of "{form.title}"
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={busy}
            >
              {busy ? "Publishing…" : "Validate & publish"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function FormsList({
  forms,
  onSelectTarget
}: {
  forms: AdminFormSummary[];
  onSelectTarget: (formId: string) => void;
}) {
  return (
    <section className="card">
      <h2>Existing forms</h2>
      {forms.length === 0 ? (
        <p className="text-muted">No forms yet.</p>
      ) : (
        <table className="forms-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Published version</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id}>
                <td>{form.title}</td>
                <td>{form.publishedVersion ?? "unpublished"}</td>
                <td>
                  <Link to={`/form/${form.id}`}>open</Link>{" "}
                  <button type="button" onClick={() => onSelectTarget(form.id)}>
                    upload new version
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function AdminPage() {
  const [state, setState] = useState<PageState>({ phase: "checking" });
  const [forms, setForms] = useState<AdminFormSummary[]>([]);
  const [target, setTarget] = useState(NEW_FORM_TARGET);
  const [published, setPublished] = useState<{
    formId: string;
    version: number;
    isNew: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((session) => {
        if (!cancelled) {
          setState(
            session.authenticated ? { phase: "ready" } : { phase: "login" }
          );
        }
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "login" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshForms = useCallback(async () => {
    try {
      setForms(await fetchAdminForms());
    } catch {
      setForms([]);
    }
  }, []);

  useEffect(() => {
    if (state.phase !== "ready") return;
    let cancelled = false;
    fetchAdminForms()
      .then((rows) => {
        if (!cancelled) setForms(rows);
      })
      .catch(() => {
        if (!cancelled) setForms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase]);

  const handleSignOut = async () => {
    await logout();
    setState({ phase: "login" });
  };

  if (state.phase === "checking") {
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
        <Link to="/">← Back to home</Link>
        {state.phase === "ready" ? (
          <>
            {" · "}
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </>
        ) : null}
      </p>

      {state.phase === "login" ? (
        <LoginCard onSuccess={() => setState({ phase: "ready" })} />
      ) : (
        <>
          {published ? (
            <p role="status" className="admin-status">
              Published {published.isNew ? "new form" : `version ${published.version}`}{" "}
              —{" "}
              <Link to={`/form/${published.formId}`}>
                open form {published.formId}
              </Link>
            </p>
          ) : null}

          <Uploader
            forms={forms}
            target={target}
            onTargetChange={setTarget}
            onPublished={(result) => {
              setPublished(result);
              void refreshForms();
            }}
          />

          <FormsList forms={forms} onSelectTarget={setTarget} />
        </>
      )}
    </main>
  );
}
