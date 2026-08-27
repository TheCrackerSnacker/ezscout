import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const ADMIN_PASSWORD = "test-admin-password";
const SESSION_KEY = "test-session-key-0123456789abcdef0123456789abcdef";

function extractCookie(headers: Record<string, unknown>): string {
  const setCookie = headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return String(raw ?? "").split(";")[0] ?? "";
}

describe("Admin auth flow", () => {
  it("logs in with correct password and sets session cookie", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(typeof res.json().csrfToken).toBe("string");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects wrong password with 401", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: "wrong" }
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("rejects invalid payload with 400", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: {}
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Invalid login payload" });
  });

  it("returns 503 when admin password is not configured", async () => {
    const app = buildApp({ sessionKey: SESSION_KEY });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: "anything" }
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "Admin not configured" });
  });

  it("reports unauthenticated session", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const res = await app.inject({ method: "GET", url: "/api/admin/session" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ authenticated: false });
  });

  it("reports authenticated session after login", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);

    const session = await app.inject({
      method: "GET",
      url: "/api/admin/session",
      headers: { cookie }
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().authenticated).toBe(true);
    expect(typeof session.json().csrfToken).toBe("string");
  });

  it("logout clears the session", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);
    const csrfToken = login.json().csrfToken as string;

    const logout = await app.inject({
      method: "POST",
      url: "/api/admin/logout",
      headers: { cookie, "x-csrf-token": csrfToken }
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });

    const logoutCookie = extractCookie(logout.headers as Record<string, unknown>);
    const session = await app.inject({
      method: "GET",
      url: "/api/admin/session",
      headers: { cookie: logoutCookie }
    });
    expect(session.json()).toEqual({ authenticated: false });
  });

  it("full auth cycle: login → session → logout → session", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });

    const s1 = await app.inject({ method: "GET", url: "/api/admin/session" });
    expect(s1.json().authenticated).toBe(false);

    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    expect(login.statusCode).toBe(200);
    const cookie = extractCookie(login.headers as Record<string, unknown>);
    const csrfToken = login.json().csrfToken as string;

    const s2 = await app.inject({
      method: "GET",
      url: "/api/admin/session",
      headers: { cookie }
    });
    expect(s2.json().authenticated).toBe(true);

    const logout = await app.inject({
      method: "POST",
      url: "/api/admin/logout",
      headers: { cookie, "x-csrf-token": csrfToken }
    });
    const logoutCookie = extractCookie(logout.headers as Record<string, unknown>);

    const s3 = await app.inject({
      method: "GET",
      url: "/api/admin/session",
      headers: { cookie: logoutCookie }
    });
    expect(s3.json().authenticated).toBe(false);
  });

  it("admin guard rejects unauthenticated requests with 401", async () => {
    const app = buildApp({ adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });
    const res = await app.inject({ method: "GET", url: "/api/admin/forms" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "Admin authentication required" });
  });

  it("admin guard returns 503 when no password configured", async () => {
    const app = buildApp({ sessionKey: SESSION_KEY });
    const res = await app.inject({ method: "GET", url: "/api/admin/forms" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "Admin not configured" });
  });
});

describe("CSRF protection", () => {
  const sampleDefinition = {
    title: "Scouting form",
    questions: [{ id: "0198f7a2-7b3c-7000-8000-000000000001", type: "text", question: "Q" }]
  };

  it("rejects admin mutations without a csrf token", async () => {
    const app = buildApp({
      adminPassword: ADMIN_PASSWORD,
      sessionKey: SESSION_KEY
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);

    const res = await app.inject({
      method: "POST",
      url: "/api/forms",
      headers: { cookie },
      payload: sampleDefinition
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe("Invalid csrf token");
  });

  it("rejects mutations with a wrong csrf token", async () => {
    const app = buildApp({
      adminPassword: ADMIN_PASSWORD,
      sessionKey: SESSION_KEY
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);

    const res = await app.inject({
      method: "POST",
      url: "/api/forms",
      headers: { cookie, "x-csrf-token": "not-the-token" },
      payload: sampleDefinition
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe("Invalid csrf token");
  });

  it("accepts mutations with a valid csrf token", async () => {
    const app = buildApp({
      adminPassword: ADMIN_PASSWORD,
      sessionKey: SESSION_KEY
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);
    const csrfToken = login.json().csrfToken as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/forms",
      headers: { cookie, "x-csrf-token": csrfToken },
      payload: sampleDefinition
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "Database not configured" });
  });

  it("admin login rate limits repeated attempts", async () => {
    const app = buildApp({
      adminPassword: ADMIN_PASSWORD,
      sessionKey: SESSION_KEY
    });
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/login",
        payload: { password: "wrong" }
      });
      expect(res.statusCode).toBe(401);
    }
    const limited = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    expect(limited.statusCode).toBe(429);
  });

  it("session endpoint issues a csrf token that validates mutations", async () => {
    const app = buildApp({
      adminPassword: ADMIN_PASSWORD,
      sessionKey: SESSION_KEY
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);

    const session = await app.inject({
      method: "GET",
      url: "/api/admin/session",
      headers: { cookie }
    });
    const csrfToken = session.json().csrfToken as string;
    expect(typeof csrfToken).toBe("string");

    const res = await app.inject({
      method: "POST",
      url: "/api/forms",
      headers: { cookie, "x-csrf-token": csrfToken },
      payload: sampleDefinition
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "Database not configured" });
  });

  it("logout is protected by csrf too", async () => {
    const app = buildApp({
      adminPassword: ADMIN_PASSWORD,
      sessionKey: SESSION_KEY
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: ADMIN_PASSWORD }
    });
    const cookie = extractCookie(login.headers as Record<string, unknown>);

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/logout",
      headers: { cookie }
    });
    expect(res.statusCode).toBe(403);
  });
});