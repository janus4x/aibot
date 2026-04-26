import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

/** Эвристика по содержимому — отсекает явный мусор без компилятора. */
export function validateWrittenContent(
  relPath: string,
  content: string
): { ok: true } | { ok: false; reason: string } {
  const base = path.basename(relPath);
  const t = content.trim();

  if (/\.(cpp|cc|cxx|c|h|hpp|hxx)$/i.test(relPath)) {
    if (t.length < 15) {
      return { ok: false, reason: `${base}: исходник слишком короткий или пустой` };
    }
    if (t.startsWith("#!/") && !/\.(sh|bash)$/i.test(relPath)) {
      return { ok: false, reason: `${base}: shebang в файле C/C++ — вероятно ошибка формата` };
    }
    const codeLike =
      /[#;{}=<>()[\]]/.test(t) &&
      /\b(int|void|char|bool|auto|return|include|namespace|class|struct|using|std|main)\b/i.test(t);
    if (!codeLike) {
      return { ok: false, reason: `${base}: текст не похож на валидный C/C++ (нет типичных ключевых слов/синтаксиса)` };
    }
    const alnum = (t.match(/[a-zA-Z0-9]/g) ?? []).length;
    if (alnum / Math.max(t.length, 1) < 0.12) {
      return { ok: false, reason: `${base}: слишком мало букв/цифр — похоже на случайный текст` };
    }
  }

  if (/\.(sh|bash)$/i.test(relPath)) {
    if (t.length < 10) {
      return { ok: false, reason: `${base}: пустой или слишком короткий shell-скрипт` };
    }
    if (!/\b(g\+\+|gcc|clang|cmake|make|ninja)\b/i.test(t) && !/^\s*#!/.test(t)) {
      return { ok: false, reason: `${base}: скрипт не содержит типичных команд сборки (g++/gcc/clang) или shebang` };
    }
  }

  if (/\.(bat|cmd)$/i.test(relPath)) {
    if (t.length < 10) {
      return { ok: false, reason: `${base}: пустой или слишком короткий .bat` };
    }
    if (!/\b(g\+\+|gcc|clang|cl\.exe|msbuild|cmake)\b/i.test(t) && !/^@/m.test(t)) {
      return { ok: false, reason: `${base}: .bat не похож на сценарий сборки (нет компилятора или директив cmd)` };
    }
  }

  return { ok: true };
}

/** Если в PATH есть `g++`, проверяет синтаксис C++ / C исходника. Иначе пропускает. */
export async function tryGppSyntaxOnly(absPath: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!/\.(cpp|cc|cxx)$/i.test(absPath)) return { ok: true };
  try {
    await execFileAsync("g++", ["-fsyntax-only", "-std=c++17", absPath], {
      timeout: 25_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { code?: string; stderr?: string; message?: string };
    if (err.code === "ENOENT") {
      return { ok: true };
    }
    const msg = (err.stderr ?? err.message ?? String(e)).slice(0, 800);
    return { ok: false, reason: `g++ -fsyntax-only: ${msg}` };
  }
}
