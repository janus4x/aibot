import fs from "node:fs";
import path from "node:path";

export interface WorkspaceFileEntry {
  /** Path relative to workspace root, forward slashes */
  path: string;
  content: string;
  truncated: boolean;
}

const SKIP_DIR = new Set(["node_modules", ".git", "__pycache__", ".vs", "build", "dist", "out", "target"]);
const MAX_FILES = 120;
const MAX_FILE_CHARS = 120_000;
const MAX_TOTAL_CHARS = 1_500_000;

function toPosix(rel: string): string {
  return rel.split(path.sep).join("/");
}

function listRelativeFiles(absRoot: string, sub = ""): string[] {
  const dir = path.join(absRoot, sub);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = sub ? `${sub}/${name}` : name;
    const abs = path.join(absRoot, rel);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIR.has(name)) continue;
      out.push(...listRelativeFiles(absRoot, rel));
    } else {
      out.push(rel);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export function readWorkspaceFiles(absRoot: string): WorkspaceFileEntry[] {
  if (!fs.existsSync(absRoot)) return [];
  const rels = listRelativeFiles(absRoot).slice(0, MAX_FILES);
  const result: WorkspaceFileEntry[] = [];
  let total = 0;
  for (const rel of rels) {
    if (total >= MAX_TOTAL_CHARS) break;
    const abs = path.join(absRoot, rel);
    const buf = fs.readFileSync(abs);
    if (looksBinary(buf)) {
      result.push({
        path: toPosix(rel),
        content: "[Бинарный файл — содержимое не показано]",
        truncated: false,
      });
      continue;
    }
    let text: string;
    try {
      text = buf.toString("utf8");
    } catch {
      result.push({
        path: toPosix(rel),
        content: "[Не удалось прочитать как UTF-8]",
        truncated: false,
      });
      continue;
    }
    let truncated = false;
    if (text.length > MAX_FILE_CHARS) {
      text = text.slice(0, MAX_FILE_CHARS);
      truncated = true;
    }
    if (total + text.length > MAX_TOTAL_CHARS) {
      const room = MAX_TOTAL_CHARS - total;
      if (room < 100) break;
      text = text.slice(0, room);
      truncated = true;
    }
    total += text.length;
    result.push({ path: toPosix(rel), content: text, truncated });
  }
  return result;
}
