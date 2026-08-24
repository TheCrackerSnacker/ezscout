import { useState } from "react";
import { validateAnswers, type FormDefinition } from "@ezscout/shared";
import type { SubmissionResult } from "../api";
import { QuestionRenderer } from "../questions/registry";

export interface FormViewProps {
  definition: FormDefinition;
  onValidSubmit?: (
    answers: Record<string, unknown>
  ) => Promise<SubmissionResult | void>;
}

interface IssueEntry {
  questionId: string;
  label: string;
}

const DEFAULT_CONFIRMATION = "Thanks! Your response has been recorded.";
const DUPLICATE_CONFIRMATION =
  "We already received this response — nothing was changed.";

export function FormView({ definition, onValidSubmit }: FormViewProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const labelFor = (questionId: string) =>
    definition.questions.find((q) => q.id === questionId)?.question ??
    questionId;

  const showValidationIssues = (entries: IssueEntry[]) => {
    setConfirmation(null);
    setServerError(false);
    setIssues(entries);
  };

  const handleSubmit = async () => {
    const result = validateAnswers(definition, answers);
    if (!result.ok) {
      showValidationIssues(
        result.issues.map((issue) => ({
          questionId: issue.questionId,
          label: labelFor(issue.questionId)
        }))
      );
      return;
    }

    setIssues([]);

    if (!onValidSubmit) {
      setServerError(false);
      setConfirmation(DEFAULT_CONFIRMATION);
      return;
    }

    setSubmitting(true);
    setConfirmation(null);
    setServerError(false);
    try {
      const outcome = await onValidSubmit(answers);
      if (outcome && outcome.status === "rejected") {
        setIssues(
          outcome.issues?.length
            ? outcome.issues.map((issue) => ({
                questionId: issue.questionId,
                label: `${labelFor(issue.questionId)} — ${issue.message}`
              }))
            : [
                {
                  questionId: "__server__",
                  label: outcome.reason ?? "The server rejected this response."
                }
              ]
        );
        return;
      }
      setConfirmation(
        outcome && outcome.status === "duplicate"
          ? DUPLICATE_CONFIRMATION
          : DEFAULT_CONFIRMATION
      );
    } catch {
      setServerError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <h2>{definition.title}</h2>
      {definition.description ? <p>{definition.description}</p> : null}

      {definition.questions.map((question) => (
        <section key={question.id}>
          <QuestionRenderer
            question={question}
            value={answers[question.id]}
            onChange={(value) =>
              setAnswers((previous) => ({ ...previous, [question.id]: value }))
            }
          />
        </section>
      ))}

      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit"}
      </button>

      {issues.length > 0 ? (
        <ul role="alert">
          {issues.map((issue) => (
            <li key={issue.questionId}>{issue.label}</li>
          ))}
        </ul>
      ) : null}

      {serverError ? (
        <p role="alert">
          Something went wrong while sending your response. Please try again.
        </p>
      ) : null}

      {confirmation !== null ? (
        <p role="status">{confirmation}</p>
      ) : null}
    </form>
  );
}
