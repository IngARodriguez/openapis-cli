// Detects the user's OS + shell + rc file location.
//
// Returns an object: { os, shell, rcPath, kind } where
//   os    = "windows" | "macos" | "linux"
//   shell = "powershell" | "cmd" | "bash" | "zsh" | "fish"
//   rcPath = absolute path to the rc / profile file we'll edit
//   kind   = "posix" | "powershell" | "cmd"     ← syntax family
//
// Detection priority:
//   1. process.platform → branches Windows vs POSIX
//   2. On Windows: prefer PowerShell if $PROFILE-equivalent is reachable;
//      fall back to CMD (setx) otherwise.
//   3. On POSIX: read $SHELL; verify the rc file exists or pick the canonical
//      one for first-time setup.

import { platform, homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function isWindows() {
  return platform() === "win32";
}

function isMac() {
  return platform() === "darwin";
}

/**
 * On Windows, `$PROFILE` is the path PowerShell uses. We need to ask
 * PowerShell itself for it (the path varies by Documents redirection,
 * OneDrive, etc.). If PowerShell isn't available, we fall back to CMD.
 */
function detectPowerShell() {
  // We want $PROFILE (a.k.a. CurrentUserCurrentHost) — the file `. $PROFILE`
  // re-sources. Using $PROFILE.CurrentUserAllHosts is also a valid profile
  // path but `. $PROFILE` would NOT reload it, breaking the user's mental
  // model.
  const candidates = ["pwsh.exe", "powershell.exe"];
  for (const exe of candidates) {
    const r = spawnSync(exe, ["-NoProfile", "-Command", "$PROFILE"], {
      encoding: "utf8",
    });
    if (r.status === 0 && r.stdout.trim()) {
      return { exe, profile: r.stdout.trim() };
    }
  }
  return null;
}

function defaultPosixRc(shell) {
  const home = homedir();
  switch (shell) {
    case "bash":
      // On Mac, bash sources .bash_profile for login shells. On Linux, .bashrc.
      if (isMac()) {
        const bp = join(home, ".bash_profile");
        if (existsSync(bp)) return bp;
        return join(home, ".bashrc");
      }
      return join(home, ".bashrc");
    case "zsh":
      return join(home, ".zshrc");
    case "fish":
      return join(home, ".config", "fish", "config.fish");
    default:
      return join(home, ".profile");
  }
}

function detectPosixShell() {
  const sh = process.env.SHELL || "";
  if (sh.includes("zsh")) return "zsh";
  if (sh.includes("fish")) return "fish";
  if (sh.includes("bash")) return "bash";
  // Fall back to bash — most universal.
  return "bash";
}

export function detect() {
  if (isWindows()) {
    const ps = detectPowerShell();
    if (ps) {
      return {
        os: "windows",
        shell: "powershell",
        rcPath: ps.profile,
        kind: "powershell",
        psExe: ps.exe,
      };
    }
    // CMD fallback. We don't write to a file — `setx` writes to user env in
    // the registry. We synthesize a virtual rcPath for the status command.
    return {
      os: "windows",
      shell: "cmd",
      rcPath: "(Windows user environment — setx)",
      kind: "cmd",
    };
  }

  const shell = detectPosixShell();
  return {
    os: isMac() ? "macos" : "linux",
    shell,
    rcPath: defaultPosixRc(shell),
    kind: "posix",
  };
}

/**
 * Pretty label for messages.
 */
export function describe(d) {
  const osLabel = { windows: "Windows", macos: "macOS", linux: "Linux" }[d.os] || d.os;
  const shellLabel = {
    powershell: "PowerShell",
    cmd: "Command Prompt",
    bash: "bash",
    zsh: "zsh",
    fish: "fish",
  }[d.shell] || d.shell;
  return { osLabel, shellLabel };
}
