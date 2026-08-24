import type { TextQuestion } from "@ezscout/shared";
import type { TypedQuestionProps } from "../types";

export function TextFieldView({
  question,
  value,
  onChange
}: TypedQuestionProps<TextQuestion, string>) {
  return (
    <label>
      {question.question}
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}
