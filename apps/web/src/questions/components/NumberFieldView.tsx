import type { NumberQuestion } from "@ezscout/shared";
import type { TypedQuestionProps } from "../types";

export function NumberFieldView({
  question,
  value,
  onChange
}: TypedQuestionProps<NumberQuestion, number | undefined>) {
  return (
    <label>
      {question.question}
      <input
        type="number"
        value={value ?? ""}
        min={question.min}
        max={question.max}
        onChange={(event) => {
          const raw = event.target.value;
          onChange?.(raw === "" ? undefined : Number(raw));
        }}
      />
    </label>
  );
}
