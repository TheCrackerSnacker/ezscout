import { useEffect, useState } from "react";
import type { PublicForm, Submission } from "@ezscout/shared";
import { ApiError, getPublishedForm, submitResponses } from "../api";
import { Link } from "../router";
import { FormView } from "./FormView";

type LoaderState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; form: PublicForm };

const NOT_FOUND_MESSAGE =
  "This form does not exist or is no longer available.";
const GENERIC_ERROR_MESSAGE =
  "Something went wrong while loading this form. Please try again later.";

export function FormLoader({ formId }: { formId: string }) {
  const [state, setState] = useState<LoaderState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    getPublishedForm(formId)
      .then((form) => {
        if (!cancelled) setState({ phase: "ready", form });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const notFound = error instanceof ApiError && error.status === 404;
        setState({
          phase: "error",
          message: notFound ? NOT_FOUND_MESSAGE : GENERIC_ERROR_MESSAGE
        });
      });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  if (state.phase === "loading") {
    return <p>Loading form…</p>;
  }

  if (state.phase === "error") {
    return (
      <div>
        <p role="alert">{state.message}</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  return (
    <FormView
      definition={state.form}
      onValidSubmit={async (answers) => {
        const submission: Submission = {
          id: crypto.randomUUID(),
          formId,
          formVersion: state.form.version,
          answers
        };
        const { results } = await submitResponses([submission]);
        return results[0];
      }}
    />
  );
}
