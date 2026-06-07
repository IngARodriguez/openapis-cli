// Tiny zero-dep UI helpers. No chalk. ANSI codes are stripped on non-TTY so
// piping output to a file stays clean.
import { createInterface } from "node:readline/promises";

const ENABLED = process.stdout.isTTY === true && !process.env.NO_COLOR;
const wrap = (code) => (s) => (ENABLED ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const bold = wrap("1");
export const dim = wrap("2");
export const red = wrap("31");
export const green = wrap("32");
export const yellow = wrap("33");
export const cyan = wrap("36");

/**
 * Yes/no prompt. Returns boolean. ENTER picks the default. Ctrl+C exits cleanly.
 * Non-TTY input → returns the default (lets `openapis init <<< ""` be idempotent).
 */
export async function confirm(question, defaultYes = true) {
  if (!process.stdin.isTTY) return defaultYes;
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = (await rl.question(`${question} ${dim(suffix)} `)).trim().toLowerCase();
    if (!ans) return defaultYes;
    if (["y", "yes", "s", "si", "sí"].includes(ans)) return true;
    if (["n", "no"].includes(ans)) return false;
    return defaultYes;
  } finally {
    rl.close();
  }
}

/**
 * Free-text prompt with default. Same TTY-fallback policy as confirm().
 */
export async function ask(question, defaultValue = "") {
  if (!process.stdin.isTTY) return defaultValue;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const hint = defaultValue ? dim(`[${defaultValue}]`) : "";
    const ans = (await rl.question(`${question} ${hint} `)).trim();
    return ans || defaultValue;
  } finally {
    rl.close();
  }
}

export function header(title) {
  process.stdout.write(`\n${bold(title)}\n${dim("─".repeat(Math.min(title.length, 40)))}\n`);
}

export function ok(line) {
  process.stdout.write(`${green("✓")} ${line}\n`);
}

export function info(line) {
  process.stdout.write(`${dim("·")} ${line}\n`);
}

export function warn(line) {
  process.stdout.write(`${yellow("!")} ${line}\n`);
}

export function fail(line) {
  process.stdout.write(`${red("✗")} ${line}\n`);
}
