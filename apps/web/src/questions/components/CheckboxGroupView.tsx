import type { CheckboxQuestion } from "@ezscout/shared";
import type { TypedQuestionProps } from "../types";

export function CheckboxGroupView({
  question,
  value,
  onChange
}: TypedQuestionProps<CheckboxQuestion, string[]>) {
  const selected = new Set(value ?? []);

  const toggle = (option: string) => {
    const next = new Set(selected);
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    onChange?.([...next]);
  };

  return (
    <fieldset>
      <legend>{question.question}</legend>
      {question.options.map((option) => (
        <label key={option}>
          <input
            type="checkbox"
            checked={selected.has(option)}
            onChange={() => toggle(option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
