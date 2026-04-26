const KEY = "agentmod.selectedTaskId";

/** taskId из ?taskId= или из localStorage (последняя открытая). */
export function readInitialTaskId(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("taskId");
  if (q?.trim()) return q.trim();
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Сохранить выбор и синхронизировать URL (?taskId=) без перезагрузки. */
export function persistTaskId(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("taskId", id);
  else url.searchParams.delete("taskId");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}
