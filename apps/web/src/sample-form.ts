import { FormDefinitionSchema, type FormDefinition } from "@ezscout/shared";

const PLACEHOLDER_DEFINITION = {
  title: "Scout Field Report",
  description: "A demo form exercising every supported question type.",
  questions: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      type: "text",
      question: "What is your name?",
      required: true
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      type: "radio",
      question: "Which zone did you scout?",
      options: ["North", "East", "South", "West"],
      required: true
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      type: "textarea",
      question: "Any additional observations?",
      required: false
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      type: "checkbox",
      question: "What did you observe?",
      options: ["Wildlife", "Water", "Trails", "Other scouts"],
      required: false
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      type: "number",
      question: "How many kilometers did you cover?",
      min: 0,
      max: 500,
      required: false
    }
  ]
} as const;

export const sampleForm: FormDefinition = FormDefinitionSchema.parse(
  PLACEHOLDER_DEFINITION
);
