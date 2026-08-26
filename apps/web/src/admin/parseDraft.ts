import { FormDefinitionSchema, type FormDefinition } from "@ezscout/shared";

export type DraftParseResult =
  | { ok: true; definition: FormDefinition }
  | {
      ok: false;
      message: string;
      issues: { path: string; message: string }[];
    };

export function parseDraft(text: string): DraftParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Not valid JSON: ${error.message}`
          : "Not valid JSON",
      issues: []
    };
  }

  const parsed = FormDefinitionSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      message: "The JSON does not match the form definition schema.",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join(".") || "body",
        message: issue.message
      }))
    };
  }

  return { ok: true, definition: parsed.data };
}
