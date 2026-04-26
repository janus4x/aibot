export interface TaskListItem {
  id: string;
  promptPreview: string;
  status: string;
  phase: string;
  updatedAt: number;
  title: string | null;
}
