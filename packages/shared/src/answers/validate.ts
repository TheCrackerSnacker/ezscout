import type { FormDefinition } from "../form-definition";
import { answerSchemaFor } from "./answer-schema";

export interface AnswerIssue {
  questionId: string;
  message: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: AnswerIssue[] };

function isUnanswered(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

export function validateAnswers(
  definition: FormDefinition,
  answers: Record<string, unknown>
): ValidationResult {
  const issues: AnswerIssue[] = [];
  const knownIds = new Set(definition.questions.map((question) => question.id));

  Object.keys(answers).forEach((key) => {
    if (!knownIds.has(key)) {
      issues.push({ questionId: key, message: "Unknown question id" });
    }
  });

  definition.questions.forEach((question) => {
    const hasKey = Object.prototype.hasOwnProperty.call(answers, question.id);
    if (!hasKey || isUnanswered(answers[question.id])) {
      if (question.required) {
        issues.push({
          questionId: question.id,
          message: "This question requires an answer"
        });
      }
      return;
    }
    const result = answerSchemaFor(question).safeParse(answers[question.id]);
    if (!result.success) {
      issues.push({
        questionId: question.id,
        message: result.error.issues[0]?.message ?? "Invalid answer"
      });
    }
  });

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
