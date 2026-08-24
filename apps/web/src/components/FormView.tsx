import { useState } from "react";
import { validateAnswers, type FormDefinition } from "@ezscout/shared";
import { QuestionRenderer } from "../questions/registry";

export interface FormViewProps {
  definition: FormDefinition;
}

interface IssueEntry {
  questionId: string;
  label: string;
}

export function FormView({ definition }: FormViewProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    const result = validateAnswers(definition, answers);
    if (result.ok) {
      setIssues([]);
      setSubmitted(true);
      return;
    }
    setSubmitted(false);
    setIssues(
      result.issues.map((issue) => ({
        questionId: issue.questionId,
        label:
          definition.questions.find((q) => q.id === issue.questionId)
            ?.question ?? issue.questionId
      }))
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
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

      <button type="submit">Submit</button>

      {!submitted && issues.length > 0 ? (
        <ul role="alert">
          {issues.map((issue) => (
            <li key={issue.questionId}>{issue.label}</li>
          ))}
        </ul>
      ) : null}

      {submitted ? (
        <p role="status">Thanks! Your response has been recorded.</p>
      ) : null}
    </form>
  );
}
