import type { Question } from "@ezscout/shared";
import { CheckboxGroupView } from "./components/CheckboxGroupView";
import { NumberFieldView } from "./components/NumberFieldView";
import { RadioGroupView } from "./components/RadioGroupView";
import { TextAreaView } from "./components/TextareaView";
import { TextFieldView } from "./components/TextFieldView";
import type { QuestionComponent } from "./types";

export const questionRegistry: Record<Question["type"], QuestionComponent> = {
  text: TextFieldView,
  textarea: TextAreaView,
  radio: RadioGroupView,
  checkbox: CheckboxGroupView,
  number: NumberFieldView
};

export interface QuestionRendererProps {
  question: Question;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function QuestionRenderer({ question, ...rest }: QuestionRendererProps) {
  const Component = questionRegistry[question.type];
  return <Component question={question} {...rest} />;
}
