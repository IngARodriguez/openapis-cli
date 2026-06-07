import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { detect, describe } from "../shells/detect.mjs";
import { findBlock, ENV_VARS } from "../shells/block.mjs";
import { BASE_URL } from "../config.mjs";
import { header, ok, info, warn, dim, green, yellow, red, bold } from "../ui.mjs";

export async function status() {
  const d = detect();
  const { osLabel, shellLabel } = describe(d);

  header("OpenAPIs · status");
  info(`OS:     ${osLabel}`);
  info(`Shell:  ${shellLabel}`);
  info(`Target: ${dim(d.rcPath)}`);
  process.stdout.write("\n");

  if (d.kind === "cmd") {
    await statusCmd();
    return;
  }

  // POSIX / PowerShell — inspect the rc file for the sentinel block.
  if (!existsSync(d.rcPath)) {
    warn("Target file does not exist yet. Run `openapis init` to create it.");
    return;
  }

  const content = await readFile(d.rcPath, "utf8");
  const block = findBlock(content);
  if (!block.found) {
    warn("No OpenAPIs block found in the target file.");
    process.stdout.write(`Run ${bold("openapis init")} to configure.\n`);
    return;
  }
  ok("Configuration block found in target file.");

  // Show what the *current shell* sees, in case the user hasn't restarted.
  process.stdout.write("\n");
  process.stdout.write(`${bold("Current shell environment:")}\n`);
  for (const name of ENV_VARS) {
    const v = process.env[name];
    if (v) {
      const label = name === "ANTHROPIC_API_KEY" ? maskKey(v) : v;
      const correctBase = name !== "ANTHROPIC_BASE_URL" || v === BASE_URL;
      process.stdout.write(`  ${name.padEnd(20)} = ${correctBase ? green(label) : yellow(label)}\n`);
    } else {
      process.stdout.write(`  ${name.padEnd(20)} = ${red("(unset — restart shell)")}\n`);
    }
  }
}

async function statusCmd() {
  // Read HKCU\Environment via reg.exe — works on any modern Windows. Safe
  // and read-only.
  for (const name of ENV_VARS) {
    const r = spawnSync(
      "reg.exe",
      ["query", "HKCU\\Environment", "/v", name],
      { encoding: "utf8" },
    );
    if (r.status === 0) {
      const m = r.stdout.match(/REG_(SZ|EXPAND_SZ)\s+(.*)$/m);
      const v = m ? m[2].trim() : "?";
      const display = name === "ANTHROPIC_API_KEY" ? maskKey(v) : v;
      ok(`${name} = ${display}`);
    } else {
      warn(`${name} is not set in the user environment.`);
    }
  }
}

function maskKey(v) {
  if (!v) return "";
  if (v.length <= 6) return "***";
  return `${v.slice(0, 3)}…${v.slice(-2)}`;
}
