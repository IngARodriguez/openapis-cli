#!/usr/bin/env node
import { init } from "../src/commands/init.mjs";
import { status } from "../src/commands/status.mjs";
import { unlink } from "../src/commands/unlink.mjs";
import { test } from "../src/commands/test.mjs";
import { red, dim, bold } from "../src/ui.mjs";

const HELP = `${bold("openapis")} — Claude Code setup for the OpenAPIs proxy

${bold("Usage:")}
  openapis <command>

${bold("Commands:")}
  init      Configure Claude Code to point at the OpenAPIs proxy (idempotent)
  status    Show whether the proxy config is active and what it looks like
  test      Run a live request against the proxy to verify connectivity
  unlink    Remove the configuration block this CLI wrote
  help      Show this help

${dim("Docs: https://openapis.online · Source: https://github.com/IngARodriguez/openapis-cli")}
`;

async function main() {
  const cmd = process.argv[2] ?? "help";
  try {
    switch (cmd) {
      case "init":
        await init(process.argv.slice(3));
        return;
      case "status":
        await status();
        return;
      case "test":
        await test();
        return;
      case "unlink":
      case "uninstall":
      case "remove":
        await unlink();
        return;
      case "help":
      case "--help":
      case "-h":
        process.stdout.write(HELP);
        return;
      case "--version":
      case "-v": {
        const { readFile } = await import("node:fs/promises");
        const { fileURLToPath } = await import("node:url");
        const { dirname, join } = await import("node:path");
        const here = dirname(fileURLToPath(import.meta.url));
        const pkg = JSON.parse(await readFile(join(here, "..", "package.json"), "utf8"));
        console.log(pkg.version);
        return;
      }
      default:
        console.error(red(`Unknown command: ${cmd}`));
        process.stdout.write("\n" + HELP);
        process.exit(2);
    }
  } catch (err) {
    console.error(red("✗ " + (err?.message ?? String(err))));
    if (process.env.OPENAPIS_DEBUG) console.error(err?.stack ?? "");
    process.exit(1);
  }
}

main();
