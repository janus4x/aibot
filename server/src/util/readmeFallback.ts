import fs from "node:fs";
import path from "node:path";
import { readWorkspaceFiles } from "./readWorkspaceFiles.js";

/** Текст для QA, если Composer пропущен: первый .md в workspace или пустая строка. */
export function pickReadmeForQa(workDir: string, promptFallback: string): string {
  const files = readWorkspaceFiles(workDir);
  const md = files.find((f) => /\.md$/i.test(f.path));
  if (md?.content) return md.content;
  const readme = path.join(workDir, "README.md");
  if (fs.existsSync(readme)) return fs.readFileSync(readme, "utf8");
  return promptFallback.slice(0, 8000);
}
