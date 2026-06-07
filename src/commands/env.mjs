// `openapis env` — prints the env-setting commands appropriate for the
// detected shell. Designed to be evaluated by the shell itself so the
// current session picks up the values without restarting.
//
// Usage:
//   PowerShell:  iex (openapis env)
//   bash/zsh:    eval "$(openapis env)"
//   fish:        openapis env | source
//
// Reads the values from the rc file (profile.ps1 / .bashrc / .zshrc / etc.)
// — the same source of truth `openapis init` writes to. If no block is
// found, falls back to the defaults from src/config.mjs.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { detect } from "../shells/detect.mjs";
import { findBlock, BEGIN, END, ENV_VARS } from "../shells/block.mjs";
import { BASE_URL, DEFAULT_KEY } from "../config.mjs";

export async function env() {
  const d = detect();

  // Step 1: try to read values from the rc file (the source of truth).
  const values = await readValuesFromFile(d);

  // Step 2: fall back to defaults if nothing found.
  const ANTHROPIC_BASE_URL = values.ANTHROPIC_BASE_URL ?? BASE_URL;
  const ANTHROPIC_API_KEY = values.ANTHROPIC_API_KEY ?? DEFAULT_KEY;

  // Step 3: emit shell-appropriate commands. NO log output to stderr/stdout
  // outside of these — the whole point is the user's shell evaluates this.
  if (d.kind === "powershell") {
    process.stdout.write(`$env:ANTHROPIC_BASE_URL = "${escapePs(ANTHROPIC_BASE_URL)}"\n`);
    process.stdout.write(`$env:ANTHROPIC_API_KEY = "${escapePs(ANTHROPIC_API_KEY)}"\n`);
  } else if (d.kind === "cmd") {
    // CMD doesn't really have eval semantics; print SET commands the user
    // can paste manually.
    process.stdout.write(`set ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}\n`);
    process.stdout.write(`set ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}\n`);
  } else if (d.shell === "fish") {
    process.stdout.write(`set -gx ANTHROPIC_BASE_URL "${escapePosix(ANTHROPIC_BASE_URL)}"\n`);
    process.stdout.write(`set -gx ANTHROPIC_API_KEY "${escapePosix(ANTHROPIC_API_KEY)}"\n`);
  } else {
    process.stdout.write(`export ANTHROPIC_BASE_URL="${escapePosix(ANTHROPIC_BASE_URL)}"\n`);
    process.stdout.write(`export ANTHROPIC_API_KEY="${escapePosix(ANTHROPIC_API_KEY)}"\n`);
  }
}

async function readValuesFromFile(d) {
  const out = {};
  if (d.kind === "cmd") return out;
  if (!existsSync(d.rcPath)) return out;
  let content;
  try {
    content = await readFile(d.rcPath, "utf8");
  } catch {
    return out;
  }
  const block = findBlock(content);
  if (!block.found) return out;
  const lines = content.split(/\r?\n/).slice(block.beginLine, block.endLine + 1);

  // Parse export NAME="VALUE" / $env:NAME = "VALUE" / set -gx NAME "VALUE"
  const patterns = [
    /^\s*export\s+([A-Z_][A-Z0-9_]*)=["']?([^"']*)["']?\s*$/i,
    /^\s*\$env:([A-Z_][A-Z0-9_]*)\s*=\s*["']([^"']*)["']\s*$/i,
    /^\s*set\s+-gx\s+([A-Z_][A-Z0-9_]*)\s+["']([^"']*)["']\s*$/i,
  ];
  for (const line of lines) {
    for (const re of patterns) {
      const m = re.exec(line);
      if (m && ENV_VARS.includes(m[1])) {
        out[m[1]] = m[2];
        break;
      }
    }
  }
  return out;
}

function escapePosix(v) {
  return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePs(v) {
  return String(v).replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$");
}
