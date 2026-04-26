import {
  Background,
  Controls,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentNode } from "./components/AgentNode";
import { ResultModal } from "./components/ResultModal";
import { buildPreflightGraph, reactFlowFromDynamic } from "./pipelineGraph";
import { persistTaskId, readInitialTaskId } from "./lib/taskStorage";
import { applyPipelineEvent, resetNodeData } from "./lib/applyPipelineEvent";
import { TaskHistory } from "./components/TaskHistory";
import type { TaskListItem } from "./types/taskList";
import type { TaskView, WorkspaceFileEntry } from "./types/task";
import type { OrchestratorEvent } from "./types/orchestratorEvent";
import { formatEventLogLine } from "./lib/formatEventLogLine";

const nodeTypes = { agent: AgentNode };

export default function App() {
  const initial = useMemo(() => buildPreflightGraph(), []);
  const [prompt, setPrompt] = useState("Напиши проект Hello world на C++ с CMake.");
  const [taskId, setTaskId] = useState<string | null>(() => readInitialTaskId());
  const [resultTask, setResultTask] = useState<TaskView | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileEntry[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [taskList, setTaskList] = useState<TaskListItem[]>([]);
  const [taskListLoading, setTaskListLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const rf = useRef<ReactFlowInstance | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshTaskList = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = (await res.json()) as { tasks: TaskListItem[] };
      setTaskList(data.tasks ?? []);
    } catch {
      /* ignore */
    } finally {
      setTaskListLoading(false);
    }
  }, []);

  const selectTaskId = useCallback((id: string | null) => {
    setTaskId(id);
    persistTaskId(id);
    setLog([]);
    setPipelineRunning(false);
    setResultOpen(false);
    if (!id) {
      const g = buildPreflightGraph();
      setNodes(resetNodeData(g.nodes));
      setEdges(g.edges);
    }
  }, [setNodes, setEdges]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rf.current = instance;
    requestAnimationFrame(() => {
      instance.fitView({ padding: 0.15, minZoom: 0.35, maxZoom: 1.25 });
    });
  }, []);

  const loadTask = useCallback(async () => {
    if (!taskId) return null;
    const [taskRes, wsRes] = await Promise.all([
      fetch(`/api/tasks/${taskId}`),
      fetch(`/api/tasks/${taskId}/workspace`),
    ]);
    if (!taskRes.ok) {
      setWorkspaceFiles([]);
      return null;
    }
    const data = (await taskRes.json()) as { task: TaskView };
    setResultTask(data.task);
    if (wsRes.ok) {
      const ws = (await wsRes.json()) as { files: WorkspaceFileEntry[] };
      setWorkspaceFiles(ws.files ?? []);
    } else {
      setWorkspaceFiles([]);
    }
    return data.task;
  }, [taskId]);

  const closeResultModal = useCallback(() => setResultOpen(false), []);

  const filteredLog = useMemo(() => {
    const q = logFilter.trim().toLowerCase();
    if (!q) return log;
    return log.filter((line) => line.toLowerCase().includes(q));
  }, [log, logFilter]);

  const requestNotifications = useCallback(() => {
    void Notification.requestPermission();
  }, []);

  useEffect(() => {
    void refreshTaskList();
  }, [refreshTaskList]);

  useEffect(() => {
    if (taskId) {
      const u = new URLSearchParams(window.location.search);
      if (u.get("taskId") !== taskId) persistTaskId(taskId);
    } else if (new URLSearchParams(window.location.search).has("taskId")) {
      persistTaskId(null);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    void (async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.status === 404) {
        selectTaskId(null);
      }
    })();
  }, [taskId, selectTaskId]);

  useEffect(() => {
    if (!taskId) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${proto}//${host}/ws?taskId=${encodeURIComponent(taskId)}`);
    ws.onmessage = (m) => {
      try {
        const ev = JSON.parse(m.data) as OrchestratorEvent;
        setLog((prev) => [...prev, formatEventLogLine(ev)].slice(-400));

        if (ev.type === "dynamic_graph" && ev.nodes?.length && ev.edges) {
          const g = reactFlowFromDynamic(ev.nodes, ev.edges);
          setNodes(resetNodeData(g.nodes));
          setEdges(g.edges);
          requestAnimationFrame(() => {
            rf.current?.fitView({ padding: 0.12, minZoom: 0.2, maxZoom: 1.5 });
          });
        } else {
          setNodes((prev) => applyPipelineEvent(prev, ev));
        }

        if (ev.type === "pipeline_complete") {
          setPipelineRunning(false);
          void refreshTaskList();
          void loadTask().then(() => setResultOpen(true));
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const ok = ev.success !== false;
            new Notification(ok ? "Пайплайн завершён" : "Пайплайн завершился с ошибкой", {
              body: ok ? "Откройте вкладку для просмотра результата." : "Смотрите лог событий.",
            });
          }
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      setLog((p) => [...p, "[ws] error"]);
    };
    return () => ws.close();
  }, [taskId, setNodes, setEdges, loadTask, refreshTaskList]);

  useEffect(() => {
    if (!taskId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/events`);
        const data = (await res.json()) as { events: OrchestratorEvent[] };
        const lines = (data.events ?? []).map((ev) => formatEventLogLine(ev));
        setLog(lines.slice(-400));
        let n: Node[] = resetNodeData(initial.nodes);
        let e = initial.edges;
        for (const ev of data.events ?? []) {
          if (ev.type === "dynamic_graph" && ev.nodes?.length && ev.edges) {
            const g = reactFlowFromDynamic(ev.nodes, ev.edges);
            n = resetNodeData(g.nodes);
            e = g.edges;
          } else {
            n = applyPipelineEvent(n, ev);
          }
        }
        setNodes(n);
        setEdges(e);
        requestAnimationFrame(() => {
          rf.current?.fitView({ padding: 0.12, minZoom: 0.2, maxZoom: 1.5 });
        });
      } catch {
        /* ignore */
      }
    })();
  }, [taskId, initial.nodes, initial.edges, setNodes, setEdges]);

  useEffect(() => {
    if (!taskId) return;
    void (async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { task: { status: string } };
      setPipelineRunning(data.task.status === "running");
    })();
  }, [taskId]);

  const nodeTypesMemo = useMemo(() => nodeTypes, []);

  const cancelPipeline = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setLog((p) => [...p, `[cancel] ${err.error ?? res.status}`]);
        return;
      }
      setPipelineRunning(false);
      void refreshTaskList();
    } catch (e) {
      setLog((p) => [...p, `[cancel] ${String(e)}`]);
    }
  }, [taskId, refreshTaskList]);

  const exportTaskJson = useCallback(() => {
    if (!taskId) return;
    window.open(`/api/tasks/${taskId}/export`, "_blank", "noopener,noreferrer");
  }, [taskId]);

  const submit = async () => {
    setBusy(true);
    setLog([]);
    setResultTask(null);
    setWorkspaceFiles([]);
    setResultOpen(false);
    const g = buildPreflightGraph();
    setNodes(resetNodeData(g.nodes));
    setEdges(g.edges);
    try {
      const health = await fetch("/api/health/llm");
      const h = (await health.json()) as { ok?: boolean; error?: string };
      if (!h.ok) {
        setLog((p) => [
          ...p,
          `[warn] LLM недоступен: ${h.error ?? "unknown"} — проверьте LM Studio. Запуск всё равно возможен.`,
        ]);
      }
      const fd = new FormData();
      fd.append("prompt", prompt);
      const files = fileRef.current?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
      }
      const res = await fetch("/api/tasks", { method: "POST", body: fd });
      if (res.status === 429) {
        const err = (await res.json()) as { error?: string };
        setLog((p) => [...p, `[429] ${err.error ?? "Сервер занят"}`]);
        return;
      }
      if (!res.ok) {
        setLog((p) => [...p, `[error] HTTP ${res.status}`]);
        return;
      }
      const data = (await res.json()) as { taskId: string };
      setPipelineRunning(true);
      setTaskId(data.taskId);
      persistTaskId(data.taskId);
      void refreshTaskList();
    } catch (e) {
      setLog((p) => [...p, String(e)]);
    } finally {
      setBusy(false);
    }
  };

  const defaultEdgeOptions = useMemo(
    () => ({ type: "smoothstep" as const, animated: true }),
    []
  );

  return (
    <div className="app-shell">
      <div className="panel panel-left">
        <h1>Задача</h1>
        <label htmlFor="prompt">Описание</label>
        <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="file-input">
          <label htmlFor="files">Вложения</label>
          <input id="files" ref={fileRef} type="file" multiple />
        </div>
        <button type="button" disabled={busy} onClick={() => void submit()}>
          Запустить пайплайн
        </button>
        {taskId ? (
          <>
            <p className="task-id-hint">
              taskId: <code>{taskId}</code>
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void loadTask().then(() => setResultOpen(true))}
            >
              Итог задачи
            </button>
            <button type="button" className="btn-secondary" onClick={() => void exportTaskJson()}>
              Экспорт JSON
            </button>
            {pipelineRunning ? (
              <button type="button" className="btn-secondary" onClick={() => void cancelPipeline()}>
                Отменить пайплайн
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={() => selectTaskId(null)}>
              Сбросить выбор
            </button>
          </>
        ) : null}
        <button type="button" className="btn-ghost" onClick={requestNotifications}>
          Разрешить уведомления
        </button>

        <TaskHistory
          items={taskList}
          selectedId={taskId}
          loading={taskListLoading}
          onSelect={(id) => selectTaskId(id)}
        />
      </div>
      <div className="flow-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypesMemo}
          defaultEdgeOptions={defaultEdgeOptions}
          onInit={onInit}
          fitView
          minZoom={0.25}
          maxZoom={1.75}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <MiniMap zoomable pannable />
          <Controls />
        </ReactFlow>
      </div>
      <div className="panel panel-right">
        <h1>События</h1>
        <div className="log-toolbar">
          <input
            type="search"
            className="log-filter"
            placeholder="Фильтр по тексту…"
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            aria-label="Фильтр лога"
          />
        </div>
        <div className="log">
          {filteredLog.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))}
        </div>
      </div>

      <ResultModal
        task={resultTask}
        workspaceFiles={workspaceFiles}
        open={resultOpen}
        onClose={closeResultModal}
      />
    </div>
  );
}
