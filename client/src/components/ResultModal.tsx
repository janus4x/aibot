import { useEffect, useMemo, useState } from "react";
import type { TaskArtifactsView, TaskView, WorkspaceFileEntry } from "../types/task";

type TabId = "summary" | "decomposition" | "files" | "readme" | "qa" | "architecture";

type Props = {
  task: TaskView | null;
  workspaceFiles: WorkspaceFileEntry[];
  open: boolean;
  onClose: () => void;
};

function formatDecompositionForDebug(artifacts: TaskArtifactsView): string {
  const d = artifacts.decomposition;
  if (!d?.subtasks?.length) {
    return "Декомпозитор ещё не сформировал подзадачи или данные недоступны.";
  }
  const blocks = d.subtasks.map((st) => {
    const deps = st.dependencies?.length ? st.dependencies.join(", ") : "нет";
    const paths = st.targetPaths?.length ? st.targetPaths.join(", ") : "(не указаны)";
    return [
      `▸ ${st.id} — ${st.title}`,
      `  Описание: ${st.description}`,
      `  Целевые файлы: ${paths}`,
      `  Критерии готовности: ${st.acceptanceCriteria}`,
      `  Зависимости: ${deps}`,
    ].join("\n");
  });
  return ["Как декомпозитор разбил работу (для отладки):", "", ...blocks].join("\n");
}

export function ResultModal({ task, workspaceFiles, open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>("summary");
  const [fileIdx, setFileIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && task?.id) setTab("summary");
  }, [open, task?.id]);

  useEffect(() => {
    setFileIdx(0);
  }, [workspaceFiles, tab, task?.id]);

  const readme = task?.artifacts.composedReadme ?? "";
  const qa = task?.artifacts.qaReport ?? "";
  const arch = task?.artifacts.architecture?.markdown ?? "";
  const decompositionText = useMemo(
    () => (task ? formatDecompositionForDebug(task.artifacts) : ""),
    [task]
  );

  const decompositionJson = useMemo(() => {
    if (!task?.artifacts.decomposition) return "";
    return JSON.stringify(task.artifacts.decomposition, null, 2);
  }, [task]);

  const summaryLines = useMemo(() => {
    if (!task) return [];
    const f = task.artifacts.formalized;
    const lines: string[] = [];
    lines.push(`Статус: ${task.status}`);
    lines.push(`Фаза: ${task.phase}`);
    if (f?.title) lines.push(`Заголовок: ${f.title}`);
    if (f?.goals?.length) lines.push(`Цели:\n${f.goals.map((g) => `• ${g}`).join("\n")}`);
    if (task.subtasks?.length) {
      lines.push(`Подзадач: ${task.subtasks.length}, выполнено: ${task.completedSubtaskIds?.length ?? 0}`);
    }
    const pl = task.artifacts.decomposition?.pipeline;
    if (pl) {
      lines.push(
        `План хвоста: Composer ${pl.skipComposer ? "выкл." : "вкл."}, QA ${pl.skipQa ? "выкл." : "вкл."}`
      );
    }
    const rev = task.artifacts.review;
    if (rev) lines.push(`Ревью: ${rev.approved ? "одобрено" : "замечания"}`);
    if (task.error) lines.push(`Ошибка: ${task.error}`);
    return lines;
  }, [task]);

  const currentFile = workspaceFiles[fileIdx];

  if (!open) return null;

  const tabs: [TabId, string][] = [
    ["summary", "Сводка"],
    ["decomposition", "Декомпозиция"],
    ["files", "Файлы кода"],
    ["readme", "README"],
    ["qa", "QA"],
    ["architecture", "Архитектура"],
  ];

  return (
    <div className="result-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="result-modal__header">
          <h2 id="result-modal-title">Итог задачи</h2>
          <button type="button" className="result-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {!task ? (
          <p className="result-modal__empty">Нет данных задачи.</p>
        ) : (
          <>
            <div className="result-modal__tabs" role="tablist">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "result-tab result-tab--active" : "result-tab"}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="result-modal__body">
              {tab === "summary" && (
                <pre className="result-pre">{summaryLines.join("\n\n")}</pre>
              )}
              {tab === "decomposition" && (
                <div className="result-decomp">
                  <pre className="result-pre result-pre--md">{decompositionText}</pre>
                  <details className="result-json-details">
                    <summary>Сырой JSON декомпозитора</summary>
                    <pre className="result-pre result-pre--md">{decompositionJson || "{}"}</pre>
                  </details>
                </div>
              )}
              {tab === "files" && (
                <div className="result-files">
                  {workspaceFiles.length === 0 ? (
                    <p className="result-modal__hint">Файлы в workspace пока не созданы или недоступны.</p>
                  ) : (
                    <>
                      <aside className="result-files__list">
                        {workspaceFiles.map((f, i) => (
                          <button
                            key={f.path}
                            type="button"
                            className={i === fileIdx ? "result-file-btn result-file-btn--active" : "result-file-btn"}
                            onClick={() => setFileIdx(i)}
                          >
                            {f.path}
                            {f.truncated ? " …" : ""}
                          </button>
                        ))}
                      </aside>
                      <div className="result-files__content">
                        {currentFile ? (
                          <>
                            <div className="result-files__path">{currentFile.path}</div>
                            {currentFile.truncated ? (
                              <p className="result-modal__hint">Файл обрезан по лимиту размера.</p>
                            ) : null}
                            <pre className="result-pre result-pre--md">{currentFile.content}</pre>
                          </>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              )}
              {tab === "readme" && (
                <pre className="result-pre result-pre--md">{readme || "README пока не сформирован."}</pre>
              )}
              {tab === "qa" && (
                <pre className="result-pre result-pre--md">{qa || "Отчёт QA пока не сформирован."}</pre>
              )}
              {tab === "architecture" && (
                <pre className="result-pre result-pre--md">
                  {arch || "Архитектура пока не сформирована."}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
