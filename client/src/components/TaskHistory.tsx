import type { TaskListItem } from "../types/taskList";

type Props = {
  items: TaskListItem[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
};

function statusLabel(s: string): string {
  switch (s) {
    case "completed":
      return "готово";
    case "failed":
      return "ошибка";
    case "running":
      return "в работе";
    case "cancelled":
      return "отмена";
    default:
      return s;
  }
}

export function TaskHistory({ items, selectedId, loading, onSelect }: Props) {
  return (
    <div className="task-history">
      <h2 className="task-history__title">История задач</h2>
      {loading ? (
        <p className="task-history__hint">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="task-history__hint">Пока нет сохранённых задач.</p>
      ) : (
        <ul className="task-history__list">
          {items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={
                  t.id === selectedId ? "task-history__row task-history__row--active" : "task-history__row"
                }
                onClick={() => onSelect(t.id)}
              >
                <span className="task-history__meta">
                  <span className={`task-history__badge task-history__badge--${t.status}`}>
                    {statusLabel(t.status)}
                  </span>
                  <time dateTime={new Date(t.updatedAt).toISOString()}>
                    {new Date(t.updatedAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
                <span className="task-history__title-line">{t.title || t.promptPreview}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
