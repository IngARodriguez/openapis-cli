import { readFile, writeFile, copyFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

import { detect, describe } from "../shells/detect.mjs";
import { renderBlock, replaceBlock } from "../shells/block.mjs";
import { BASE_URL, DEFAULT_KEY } from "../config.mjs";
import { header, ok, info, warn, fail, ask, confirm, bold, dim, cyan } from "../ui.mjs";

const FLAG_HELP = `Usage: openapis init [--key <value>] [--yes]

Options:
  --key <value>   API key to write. Default: prompts (default value "admin").
  --yes, -y       Non-interactive: accept all defaults.
  --help, -h      Show this help.
`;

function parseArgs(argv) {
  const out = { key: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--key") out.key = argv[++i];
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(FLAG_HELP);
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return out;
}

export async function init(argv = []) {
  const args = parseArgs(argv);
  const d = detect();
  const { osLabel, shellLabel } = describe(d);

  header("OpenAPIs · Claude Code setup");
  ok(`OS:     ${osLabel}`);
  ok(`Shell:  ${shellLabel}`);
  ok(`Target: ${dim(d.rcPath)}`);
  process.stdout.write("\n");

  // Resolve API key.
  let apiKey = args.key;
  if (!apiKey) {
    if (args.yes) {
      apiKey = DEFAULT_KEY;
    } else {
      apiKey = (await ask(`API key to use:`, DEFAULT_KEY)) || DEFAULT_KEY;
    }
  }

  if (d.kind === "cmd") {
    await writeCmd(apiKey);
    return;
  }

  await writeRcFile(d, apiKey);
}

async function writeRcFile(d, apiKey) {
  // Ensure the parent directory exists (e.g. ~/.config/fish for first-time fish users,
  // or ~/Documents/PowerShell for first-time PowerShell users).
  const dir = dirname(d.rcPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    info(`Created ${dir}`);
  }

  // Read existing content (or treat as empty if file is missing).
  let current = "";
  if (existsSync(d.rcPath)) {
    current = await readFile(d.rcPath, "utf8");
  }

  // Backup if the file existed and we'll be modifying it.
  if (current.length > 0) {
    const backup = `${d.rcPath}.bak.openapis`;
    if (!existsSync(backup)) {
      await copyFile(d.rcPath, backup);
      info(`Backed up existing file → ${dim(backup)}`);
    } else {
      info(`Backup already exists (preserved): ${dim(backup)}`);
    }
  }

  const block = renderBlock(d.kind, {
    ANTHROPIC_BASE_URL: BASE_URL,
    ANTHROPIC_API_KEY: apiKey,
  });
  const next = replaceBlock(current, block);

  if (next === current) {
    ok("Already configured — nothing to do.");
  } else {
    await writeFile(d.rcPath, next, "utf8");
    ok("Configuration block written.");
  }

  process.stdout.write("\n");
  process.stdout.write(`${bold("Next steps:")}\n`);
  if (d.kind === "powershell") {
    process.stdout.write(`  Open a new PowerShell window and run ${cyan("claude")}.\n`);
    process.stdout.write(`  ${dim(`(Same window? Run ${cyan("iex (openapis env)")}${dim(" first.")}`)}\n`);
  } else if (d.shell === "fish") {
    process.stdout.write(`  Open a new terminal and run ${cyan("claude")}.\n`);
    process.stdout.write(`  ${dim(`(Same shell? Run ${cyan("openapis env | source")}${dim(" first.")}`)}\n`);
  } else {
    process.stdout.write(`  Open a new terminal and run ${cyan("claude")}.\n`);
    process.stdout.write(`  ${dim(`(Same shell? Run ${cyan('eval "$(openapis env)"')}${dim(" first.")}`)}\n`);
  }
  process.stdout.write(`\n${dim("Tip: `openapis status` to inspect · `openapis test` to verify · `openapis unlink` to remove.")}\n`);
}

async function writeCmd(apiKey) {
  // CMD has no rc file; we use `setx` which writes to HKCU\Environment.
  // `setx` notifies WM_SETTINGCHANGE so new CMD sessions pick it up, but
  // existing sessions do NOT — we have to tell the user.
  const cmd = "setx.exe";
  const r1 = spawnSync(cmd, ["ANTHROPIC_BASE_URL", BASE_URL], { encoding: "utf8" });
  const r2 = spawnSync(cmd, ["ANTHROPIC_API_KEY", apiKey], { encoding: "utf8" });
  if (r1.status !== 0 || r2.status !== 0) {
    fail(`setx failed: ${(r1.stderr || r2.stderr || "").trim()}`);
    throw new Error("Failed to write Windows user environment.");
  }
  ok("ANTHROPIC_BASE_URL written to user environment.");
  ok("ANTHROPIC_API_KEY  written to user environment.");
  process.stdout.write("\n");
  warn("Open a NEW Command Prompt window — current sessions won't see the new variables.");
  process.stdout.write(`Then run ${cyan("claude")}.\n`);
}
