import type { RadioQuestion } from "@ezscout/shared";
import type { TypedQuestionProps } from "../types";

export function RadioGroupView({
  question,
  value,
  onChange
}: TypedQuestionProps<RadioQuestion, string>) {
  return (
    <fieldset>
      <legend>{question.question}</legend>
      {question.options.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name={question.id}
            value={option}
            checked={value === option}
            onChange={() => onChange?.(option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
