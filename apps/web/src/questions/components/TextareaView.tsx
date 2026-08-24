import type { TextareaQuestion } from "@ezscout/shared";
import type { TypedQuestionProps } from "../types";

export function TextAreaView({
  question,
  value,
  onChange
}: TypedQuestionProps<TextareaQuestion, string>) {
  return (
    <label>
      {question.question}
      <textarea
        rows={3}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}
