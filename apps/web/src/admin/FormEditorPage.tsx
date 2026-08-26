import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  fetchAdminForms,
  fetchFormDefinition,
  publishForm,
  uploadDefinition,
  type AdminFormSummary
} from "../api";
import { Link } from "../router";
import { parseDraft } from "./parseDraft";

const NEW_FORM_TARGET = "__new__";

interface FormEditorPageProps {
  formId?: string;
}

export function FormEditorPage({ formId }: FormEditorPageProps) {
  const [draftText, setDraftText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<AdminFormSummary[]>([]);
  const [target, setTarget] = useState(formId ?? NEW_FORM_TARGET);
  const [existingTitle, setExistingTitle] = useState<string | null>(null);
  const [nextVersion, setNextVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!formId);
  const [published, setPublished] = useState<{
    formId: string;
    version: number;
  } | null>(null);

  const parsed = useMemo(() => parseDraft(draftText), [draftText]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    fetchFormDefinition(formId)
      .then((data) => {
        if (cancelled) return;
        setExistingTitle(data.title);
        setDraftText(JSON.stringify(data.definition, null, 2));
        setNextVersion((data.publishedVersion ?? 0) + 1);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the form definition.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formId]);

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
      setPublished({ formId: published.id, version: published.version });
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

  if (loading) {
    return <p className="text-muted">Loading form…</p>;
  }

  if (published) {
    return (
      <section className="card">
        <p role="status" className="admin-status">
          Published version {published.version} —{" "}
          <Link to={`/form/${published.formId}`}>
            open form {published.formId}
          </Link>
        </p>
        <p style={{ marginTop: "0.75rem" }}>
          <Link to="/admin">← Back to forms</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="uploader card">
      {existingTitle ? (
        <h2>Edit: {existingTitle}</h2>
      ) : (
        <h2>Upload a form definition</h2>
      )}

      {nextVersion !== null ? (
        <p className="text-muted">
          This will be published as version {nextVersion}.
        </p>
      ) : null}

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
            Valid: &ldquo;{parsed.definition.title}&rdquo; —{" "}
            {parsed.definition.questions.length} question(s)
          </h3>
          {!formId ? (
            <div className="row">
              <label>
                Publish as{" "}
                <select
                  aria-label="Publish target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value={NEW_FORM_TARGET}>a new form</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      new version of &ldquo;{form.title}&rdquo;
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <div className="row">
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

      <p style={{ marginTop: "0.75rem" }}>
        <Link to="/admin">← Back to forms</Link>
      </p>
    </section>
  );
}
