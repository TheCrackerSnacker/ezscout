import type {
  FormDefinition,
  PublicForm,
  PublicFormSummary,
  Submission,
  SubmissionBatchResult
} from "@ezscout/shared";
import { PublicFormListSchema, PublicFormSchema } from "@ezscout/shared";
import { db } from "./offline/db";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null = null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export interface AdminFormSummary {
  id: string;
  title: string;
  publishedVersion: number | null;
  updatedAt: string;
}

async function apiErrorFrom(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof body.error === "string" && body.error) {
      return new ApiError(response.status, body.error, body.error);
    }
    if (typeof body.message === "string" && body.message) {
      return new ApiError(response.status, body.message, body.message);
    }
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return new ApiError(response.status, `Request failed (${response.status})`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw await apiErrorFrom(response);
  }
  return (await response.json()) as T;
}

let csrfToken: string | null = null;

function csrfHeaders(): Record<string, string> {
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

export async function getPublishedForm(formId: string): Promise<PublicForm> {
  try {
    const response = await fetch(`/api/forms/${formId}`);
    if (!response.ok) {
      throw await apiErrorFrom(response);
    }
    const form = PublicFormSchema.parse(await response.json());
    await db.forms.put({
      id: formId,
      definition: form,
      fetchedAt: Date.now()
    });
    return form;
  } catch (error) {
    if (navigator.onLine) throw error;
    const cached = await db.forms.get(formId);
    if (cached) return cached.definition;
    throw error;
  }
}

export async function fetchPublicForms(): Promise<PublicFormSummary[]> {
  try {
    const body = PublicFormListSchema.parse(
      await requestJson<unknown>("/api/forms")
    );
    return body.forms;
  } catch (error) {
    if (navigator.onLine) throw error;
    const cached = await db.forms.toArray();
    return cached
      .map(({ id, definition }) => ({
        id,
        title: definition.title,
        description: definition.description,
        version: definition.version
      }))
      .sort((a, b) => b.version - a.version);
  }
}

export interface QueuedBatchResult extends SubmissionBatchResult {
  queued?: boolean;
}

export async function submitResponses(
  submissions: Submission[]
): Promise<QueuedBatchResult> {
  if (!navigator.onLine) {
    await db.outbox.bulkAdd(
      submissions.map((s) => ({
        id: s.id,
        formId: s.formId,
        formVersion: s.formVersion,
        answers: s.answers as Record<string, unknown>,
        submittedAt: s.submittedAt ?? new Date().toISOString(),
        createdAt: Date.now(),
        retryCount: 0,
        lastAttemptAt: 0
      })),
      { allKeys: false }
    );
    return {
      results: submissions.map((s, i) => ({
        index: i,
        id: s.id,
        status: "accepted" as const,
        queued: true
      })),
      queued: true
    };
  }

  return requestJson<QueuedBatchResult>("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responses: submissions })
  });
}

export async function fetchSession(): Promise<{ authenticated: boolean }> {
  const body = await requestJson<{ authenticated: boolean; csrfToken?: string }>(
    "/api/admin/session"
  );
  if (body.csrfToken) csrfToken = body.csrfToken;
  return { authenticated: body.authenticated };
}

export async function login(password: string): Promise<void> {
  const body = await requestJson<{ ok: boolean; csrfToken?: string }>(
    "/api/admin/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    }
  );
  if (body.csrfToken) csrfToken = body.csrfToken;
}

export async function logout(): Promise<void> {
  await requestJson("/api/admin/logout", {
    method: "POST",
    headers: csrfHeaders()
  });
}

export async function fetchAdminForms(): Promise<AdminFormSummary[]> {
  const body = await requestJson<{ forms: AdminFormSummary[] }>(
    "/api/admin/forms"
  );
  return body.forms;
}

export async function uploadDefinition(
  definition: FormDefinition,
  targetFormId?: string
): Promise<{ id: string }> {
  const csrf = csrfHeaders();
  if (targetFormId) {
    return requestJson<{ id: string }>(
      `/api/forms/${targetFormId}/definition`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrf },
        body: JSON.stringify(definition)
      }
    );
  }
  return requestJson<{ id: string }>("/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrf },
    body: JSON.stringify(definition)
  });
}

export async function publishForm(
  formId: string
): Promise<{ id: string; version: number }> {
  return requestJson<{ id: string; version: number }>(
    `/api/forms/${formId}/publish`,
    { method: "POST", headers: csrfHeaders() }
  );
}

export async function fetchFormDefinition(
  formId: string
): Promise<{
  id: string;
  title: string;
  definition: FormDefinition;
  publishedVersion: number | null;
}> {
  return requestJson(`/api/admin/forms/${formId}`);
}
