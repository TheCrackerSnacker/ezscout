import type { ComponentType } from "react";
import type { Question } from "@ezscout/shared";

export interface TypedQuestionProps<Q extends Question = Question, V = unknown> {
  question: Q;
  value?: V;
  onChange?: (value: V) => void;
}

export type AnyQuestionProps = {
  question: any;
  value?: any;
  onChange?: (value: any) => void;
};

export type QuestionComponent = ComponentType<AnyQuestionProps>;
