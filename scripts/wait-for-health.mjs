/**
 * Polls a URL until it responds 2xx or the timeout elapses.
 *
 * Replaces the fragile fixed `sleep` used to wait for the docker-compose test
 * stack: it exits as soon as the API is actually serving (health endpoint 2xx)
 * instead of guessing an arbitrary delay, and fails fast on hard errors.
 *
 * Uses node:http rather than the global fetch: undici's async teardown can trip
 * a libuv assertion at process exit on Windows, which aborts the caller's build
 * step with a non-zero exit.
 *
 * Usage: node scripts/wait-for-health.mjs <url> [timeoutMs] [intervalMs]
 */

import http from "node:http";

const rawUrl = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 60_000);
const intervalMs = Number(process.argv[4] ?? 2_000);
const perAttemptMs = Number(process.argv[5] ?? 5_000);

if (!rawUrl) {
  console.error("usage: node scripts/wait-for-health.mjs <url> [timeoutMs] [intervalMs]");
  process.exit(2);
}

const target = new URL(rawUrl);
const deadline = Date.now() + timeoutMs;

const check = () =>
  new Promise((resolve) => {
    const request = http.get(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        timeout: perAttemptMs
      },
      (response) => {
        response.resume();
        const ok =
          typeof response.statusCode === "number" &&
          response.statusCode >= 200 &&
          response.statusCode < 300;
        resolve({ ok, status: response.statusCode ?? 0 });
      }
    );
    request.on("timeout", () => {
      request.destroy();
      resolve({ ok: false, status: 0 });
    });
    request.on("error", () => resolve({ ok: false, status: 0 }));
  });

while (Date.now() < deadline) {
  const { ok, status } = await check();
  if (ok) {
    console.log(`Healthy: ${rawUrl} -> ${status}`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(`Timed out after ${timeoutMs}ms waiting for ${rawUrl}`);
process.exit(1);