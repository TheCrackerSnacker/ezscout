/**
 * Polls a URL until it responds 2xx or the timeout elapses.
 *
 * Replaces the fragile fixed `sleep` used to wait for the docker-compose test
 * stack: it exits as soon as the API is actually serving (health endpoint 2xx)
 * instead of guessing an arbitrary delay, and fails fast on hard errors.
 *
 * Usage: node scripts/wait-for-health.mjs <url> [timeoutMs] [intervalMs]
 */

const url = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 60_000);
const intervalMs = Number(process.argv[4] ?? 2_000);

if (!url) {
  console.error("usage: node scripts/wait-for-health.mjs <url> [timeoutMs] [intervalMs]");
  process.exit(2);
}

const deadline = Date.now() + timeoutMs;

while (true) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    console.error(`Timed out after ${timeoutMs}ms waiting for ${url}`);
    process.exit(1);
  }

  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log(`Healthy: ${url} -> ${response.status}`);
      process.exit(0);
    }
  } catch {
    // Connection refused / DNS — stack still coming up, keep polling.
  }

  await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
}