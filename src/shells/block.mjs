// Renders / parses the sentinel block we write into the user's rc file.
//
// Layout (POSIX example):
//
//   # >>> openapis-cli >>>
//   # Managed by @openapis/proxy. Run `openapis unlink` to remove.
//   export ANTHROPIC_BASE_URL="https://api.openapis.online/anthropic"
//   export ANTHROPIC_API_KEY="admin"
//   # <<< openapis-cli <<<
//
// PowerShell uses `#` comments too — same delimiters work.
// CMD doesn't use rc files; it uses `setx` and we never produce a block for it.

export const BEGIN = "# >>> openapis-cli >>>";
export const END = "# <<< openapis-cli <<<";
const HEADER_NOTE =
  "# Managed by @openapis/proxy. Run `openapis unlink` to remove.";

export const ENV_VARS = ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY"];

/**
 * Render the block content (no surrounding blank lines — `replaceBlock` adds
 * them as needed).
 *
 *   kind: "posix" | "powershell"
 *   values: { ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY }
 */
export function renderBlock(kind, values) {
  const lines = [BEGIN, HEADER_NOTE];
  for (const name of ENV_VARS) {
    const value = values[name];
    if (value == null) continue;
    if (kind === "powershell") {
      lines.push(`$env:${name} = "${escapePs(value)}"`);
    } else {
      lines.push(`export ${name}="${escapePosix(value)}"`);
    }
  }
  lines.push(END);
  return lines.join("\n");
}

function escapePosix(v) {
  // Quotes get escaped inside double-quoted strings; backslashes too.
  return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePs(v) {
  // PowerShell double-quoted strings: backtick escapes; double quote with backtick.
  return String(v).replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$");
}

/**
 * Find the begin/end indices of an existing block in a file's content.
 * Returns { found, beginLine, endLine } where lines are 0-indexed.
 */
export function findBlock(content) {
  const lines = content.split(/\r?\n/);
  let beginLine = -1;
  let endLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === BEGIN) beginLine = i;
    if (lines[i].trim() === END && beginLine !== -1) {
      endLine = i;
      break;
    }
  }
  return { found: beginLine !== -1 && endLine !== -1, beginLine, endLine };
}

/**
 * Replace (or append) the sentinel block in `content` with `block`. Returns the
 * new content. Preserves trailing newline conventions of the original.
 */
export function replaceBlock(content, block) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const norm = content.replace(/\r\n/g, "\n");
  const lines = norm.split("\n");
  const { found, beginLine, endLine } = findBlock(norm);

  if (found) {
    const before = lines.slice(0, beginLine);
    const after = lines.slice(endLine + 1);
    const newLines = [...before, ...block.split("\n"), ...after];
    return newLines.join(eol);
  }

  // Append. Add a leading blank line if the file doesn't already end with one
  // (and isn't empty), to keep our block visually separated.
  let prefix = "";
  if (norm.length > 0 && !norm.endsWith("\n")) prefix = "\n";
  if (norm.length > 0 && !norm.endsWith("\n\n")) prefix += "\n";
  return (norm + prefix + block + "\n").replace(/\n/g, eol);
}

/**
 * Remove the sentinel block. Returns { content, removed: boolean }.
 */
export function removeBlock(content) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const norm = content.replace(/\r\n/g, "\n");
  const lines = norm.split("\n");
  const { found, beginLine, endLine } = findBlock(norm);
  if (!found) return { content, removed: false };

  // Eat a single blank line above/below the block to avoid leaving gaps.
  let from = beginLine;
  let to = endLine + 1;
  if (from > 0 && lines[from - 1].trim() === "") from -= 1;
  if (to < lines.length && lines[to].trim() === "") to += 1;

  const before = lines.slice(0, from);
  const after = lines.slice(to);
  const joined = [...before, ...after].join(eol);
  return { content: joined, removed: true };
}
