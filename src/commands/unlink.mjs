import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { detect, describe } from "../shells/detect.mjs";
import { removeBlock, ENV_VARS } from "../shells/block.mjs";
import { header, ok, info, warn, dim, bold } from "../ui.mjs";

export async function unlink() {
  const d = detect();
  const { osLabel, shellLabel } = describe(d);

  header("OpenAPIs · unlink");
  info(`OS:     ${osLabel}`);
  info(`Shell:  ${shellLabel}`);
  info(`Target: ${dim(d.rcPath)}`);
  process.stdout.write("\n");

  if (d.kind === "cmd") {
    await unlinkCmd();
    return;
  }

  if (!existsSync(d.rcPath)) {
    warn("Target file does not exist — nothing to remove.");
    return;
  }

  const content = await readFile(d.rcPath, "utf8");
  const { content: next, removed } = removeBlock(content);
  if (!removed) {
    warn("No OpenAPIs block found in target file — nothing to do.");
    return;
  }
  await writeFile(d.rcPath, next, "utf8");
  ok("Configuration block removed from target file.");
  process.stdout.write(`${dim("Restart your shell for the change to take effect.")}\n`);
}

async function unlinkCmd() {
  for (const name of ENV_VARS) {
    // reg delete is the right call for `setx`-written vars (`setx /D` does not exist).
    const r = spawnSync(
      "reg.exe",
      ["delete", "HKCU\\Environment", "/v", name, "/f"],
      { encoding: "utf8" },
    );
    if (r.status === 0) {
      ok(`${name} removed from user environment.`);
    } else {
      warn(`${name} was not present.`);
    }
  }
  process.stdout.write("\n");
  warn("Open a NEW Command Prompt to see the change.");
}
