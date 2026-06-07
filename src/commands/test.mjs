import { STATUS_URL, BASE_URL } from "../config.mjs";
import { header, ok, fail, info, dim, bold } from "../ui.mjs";

// `openapis test` does TWO checks:
//   1. /status returns 200 → proxy is up
//   2. POST to {BASE_URL}/v1/messages with the current shell's API key
//      returns 200 → auth works for the user's key right now
// The second check uses very small (~1 token) payload to stay free-tier friendly.

const TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url, opts = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function test() {
  header("OpenAPIs · connectivity test");

  // Step 1 — proxy is reachable.
  info(`GET  ${STATUS_URL}`);
  try {
    const res = await fetchWithTimeout(STATUS_URL);
    if (res.status === 200) {
      const body = await res.json();
      const level = body?.level ?? "?";
      ok(`/status 200 · level=${level}`);
    } else {
      fail(`/status returned ${res.status} — proxy may be down or maintenance is on.`);
      return;
    }
  } catch (e) {
    fail(`Could not reach /status: ${e.message}`);
    return;
  }

  // Step 2 — auth roundtrip via Anthropic-shaped POST.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    info("ANTHROPIC_API_KEY is not set in this shell — skipping auth roundtrip.");
    info(`(Tip: restart your shell after ${bold("openapis init")}, or pass --key.)`);
    return;
  }

  const base = process.env.ANTHROPIC_BASE_URL || BASE_URL;
  const url = `${base.replace(/\/+$/, "")}/v1/messages`;
  info(`POST ${url}`);

  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Cheapest model in the Claude 4.x family — keeps `openapis test`
        // free-tier friendly for both us and the user's pool.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (res.status === 200) {
      ok("Auth roundtrip OK — Claude Code will work with this config.");
    } else if (res.status === 401 || res.status === 403) {
      fail(`Auth failed: HTTP ${res.status}. Wrong API key?`);
    } else {
      const txt = await res.text();
      fail(`Unexpected response ${res.status}: ${txt.slice(0, 200)}`);
    }
  } catch (e) {
    fail(`Auth roundtrip failed: ${e.message}`);
  }
}
