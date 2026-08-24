import { z } from "zod";
import type { Question } from "../questions";

function optionValue(options: readonly string[]) {
  return z.string().refine((value) => options.includes(value), {
    message: "Answer must be one of the provided options"
  });
}

export function answerSchemaFor(question: Question) {
  switch (question.type) {
    case "text":
    case "textarea":
      return z.string().min(1);
    case "radio":
      return optionValue(question.options);
    case "checkbox": {
      const schema = z.array(optionValue(question.options));
      return question.required ? schema.min(1) : schema;
    }
    case "number": {
      let schema: z.ZodNumber = z.number();
      if (question.min !== undefined) {
        schema = schema.min(question.min);
      }
      if (question.max !== undefined) {
        schema = schema.max(question.max);
      }
      return schema;
    }
  }
}
