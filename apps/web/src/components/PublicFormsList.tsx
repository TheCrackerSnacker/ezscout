import { useEffect, useState } from "react";
import type { PublicFormSummary } from "@ezscout/shared";
import { fetchPublicForms } from "../api";
import { Link } from "../router";

type ListState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; forms: PublicFormSummary[] };

export function PublicFormsList() {
  const [state, setState] = useState<ListState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchPublicForms()
      .then((forms) => {
        if (!cancelled) setState({ phase: "ready", forms });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setState({ phase: "loading" });
    fetchPublicForms()
      .then((forms) => setState({ phase: "ready", forms }))
      .catch(() => setState({ phase: "error" }));
  };

  return (
    <section>
      <h1>Available forms</h1>
      {state.phase === "loading" ? (
        <p className="text-muted">Loading…</p>
      ) : state.phase === "error" ? (
        <div>
          <p role="alert">Couldn't load the available forms.</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : state.forms.length === 0 ? (
        <p className="text-muted">No forms available yet.</p>
      ) : (
        <ul className="forms-list">
          {state.forms.map((form) => (
            <li key={form.id} className="card">
              <Link to={`/form/${form.id}`}>{form.title}</Link>
              {form.description ? (
                <p className="description" title={form.description}>
                  {form.description}
                </p>
              ) : null}
              <p className="text-muted">
                v{form.version}
                {form.publishedAt
                  ? ` · published ${new Date(form.publishedAt).toLocaleDateString()}`
                  : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}