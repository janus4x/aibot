# AgentMOD — контекст проекта для ИИ и разработчика

Этот файл можно **целиком прикладывать к запросу** к модели (или вставлять в системный промпт), затем описывать новую задачу: модель должна понять структуру репозитория, ограничения и разумные шаги реализации.

**Репозиторий:** монорепозиторий npm workspaces (`server`, `client`). Корень: `agentmod`.

---

## Назначение

Оркестратор многоагентного пайплайна: пользователь вводит задачу (и опционально файлы), сервер последовательно вызывает LLM-агентов (OpenAI-совместимый API, по умолчанию **LM Studio** на `127.0.0.1:1234`), сохраняет состояние задачи и артефакты, шлёт события в UI по **WebSocket**. Клиент — **React + Vite + React Flow** (`@xyflow/react`): граф агентов, лог, история задач, модалка результата.

---

## Запуск

| Команда (из корня) | Назначение |
|--------------------|------------|
| `npm run dev` | Сервер (`tsx watch`) + клиент Vite (обычно порт **5173**) |
| `npm run build` | Сборка client → `server/public`, затем `tsc` сервера |
| `npm start` | Прод: `node server/dist/index.js` (нужна предварительная сборка) |
| `npm run smoke:llm` | Скрипт проверки LLM в пакете server |

Сервер слушает **`PORT`** (по умолчанию **3000**), отдаёт статику из `server/public` и API.

---

## Переменные окружения (важные)

| Переменная | Смысл |
|------------|--------|
| `LM_STUDIO_BASE_URL` | База OpenAI API, по умолчанию `http://127.0.0.1:1234/v1` |
| `LM_STUDIO_MODEL` / подстановки в YAML | Модель в `config/agents/*.yaml` через `${LM_STUDIO_MODEL:-…}` |
| `LM_STUDIO_API_KEY` | По умолчанию `lm-studio` |
| `LLM_TIMEOUT_MS` | Таймаут HTTP к LLM в мс; минимум ~10 с; **`0` ≈ без лимита на стороне клиента**; по умолчанию **86400000** (24 ч). В логах сервера строка `[llm] HTTP timeout…` |
| `TASK_STORE` | `sqlite` или `mongo` — **перекрывает** `config/database.yaml` |
| `PORT` | Порт HTTP сервера |

---

## Конфигурация (файлы)

| Путь | Содержание |
|------|------------|
| `config/database.yaml` | Провайдер хранилища задач: `sqlite` / `mongo`, пути и URI |
| `config/orchestrator.yaml` | `maxParallel`, `maxReviewRounds`, `maxConcurrentPipelines` |
| `config/roles.yaml` | Маппинг `subtask.role` → агент (`devWorker` / `textWorker`) и подписи UI; `fallbackRole` |
| `config/agents/<role>.yaml` | Для каждого агента: `model`, `temperature`, `maxTokens`, `systemPromptFile` |

Промпты агентов лежат в **`prompts/*.md`**, пути задаются в YAML агента.

---

## Пайплайн (логика `server/src/orchestrator/pipeline.ts`)

Типичный порядок фаз:

1. **Coordinator** — формализация задачи (артефакт `formalized`).
2. **Architect** — документ архитектуры (markdown).
3. Цикл **Decomposer ↔ Reviewer** до одобрения или лимита раундов (`maxReviewRounds`).
4. Событие **`dynamic_graph`** — клиент перестраивает граф под реальные подзадачи (`buildDynamicGraph.ts`).
5. **Workers** — подзадачи с учётом зависимостей; параллельность ограничена `maxParallel`. Роль подзадачи → исполнитель через `workerDispatch.ts` и `config/roles.yaml`.
6. Опционально **Composer** (итоговый README), затем опционально **QA** — если в плане декомпозиции не указано `skipComposer` / `skipQa`.

Рабочие файлы задачи: **`data/tasks/<taskId>/workspace/`**; вложения: **`…/attachments/`**.

---

## Оркестратор (структура кода)

- **`server/src/orchestrator/pipeline.ts`** — запуск пайплайна, сбор зависимостей `PipelineStepDeps`, вызов шагов по порядку.
- **`server/src/orchestrator/pipelineEmit.ts`** — `taskDirs`, `buildEmit`, `progress`, тип `EmitFn`.
- **`server/src/orchestrator/pipelineTypes.ts`** — общий контекст шагов.
- **`server/src/orchestrator/steps/*.ts`** — фазы: coordinator, architect, decomposer+reviewer, workers, composer+QA+финал.
- **`server/src/http/routes.ts`** — регистрация REST и WebSocket (`registerAppRoutes`).

## Агенты и код

| Роль (в коде / событиях) | Реализация | Промпт |
|---------------------------|------------|--------|
| coordinator | `server/src/agents/coordinator.agent.ts` | `prompts/coordinator.md` |
| architect | `agents/architect.agent.ts` | `prompts/architect.md` |
| decomposer | `agents/decomposer.agent.ts` | `prompts/decomposer.md` |
| reviewer | `agents/reviewer.agent.ts` | `prompts/reviewer.md` |
| devWorker | `agents/devWorker.agent.ts` | `prompts/devWorker.md` — код, JSON `filesWritten` |
| textWorker | `agents/textWorker.agent.ts` | `prompts/textWorker.md` — текст; тела файлов через **`contentBase64`** (UTF-8), см. конфиг |
| composer | `agents/composer.agent.ts` | `prompts/composer.md` |
| qa | `agents/qa.agent.ts` | `prompts/qa.md` |

Парсинг JSON от LLM: **`server/src/util/jsonFromLlm.ts`** (забор из fenced block, извлечение объекта, при необходимости **jsonrepair**).

Точка входа HTTP/WebSocket: **`server/src/index.ts`**. События в браузер: **`server/src/ws/hub.ts`**.

---

## API (кратко)

- `GET /api/health`
- `GET /api/health/llm` — проверка доступности LM Studio (`/v1/models`)
- `GET /api/config/models`
- `GET /api/tasks` — список задач (краткие поля для UI)
- `GET /api/tasks/:id` — полная задача
- `GET /api/tasks/:id/events` — лог событий для восстановления UI
- `GET /api/tasks/:id/export` — скачивание JSON (задача + события + индекс файлов workspace)
- `POST /api/tasks/:id/cancel` — отмена: `AbortSignal` на текущий HTTP к LLM (статус `cancelled`)
- `GET /api/tasks/:id/workspace` — дерево файлов workspace
- `POST /api/tasks` — multipart: поле `prompt` + файлы; создаёт задачу и асинхронно запускает `runPipeline`. При превышении **`maxConcurrentPipelines`** (см. `config/orchestrator.yaml`) — **HTTP 429**
- WebSocket: **`/ws?taskId=<uuid>`** — стрим событий по задаче

---

## Клиент

- **`client/src/App.tsx`** — состояние задачи, граф, WebSocket, история (`TaskHistory`), выбор задачи (`localStorage` + `?taskId=`).
- **`client/src/lib/applyPipelineEvent.ts`** — обновление узлов React Flow по событиям оркестратора.
- **`client/src/types/orchestratorEvent.ts`** — тип события с бэкенда.
- **`client/src/pipelineGraph.ts`**, **`AgentNode.tsx`** — узлы/рёбра React Flow.
- **`client/src/lib/taskStorage.ts`** — персист выбранного `taskId`.

Сборка клиента кладёт артефакты в **`server/public`** для единого origin в проде.

---

## Как ставить задачу ИИ, имея только этот файл

1. Вставь **этот файл** (или ссылку на него) в начало запроса.
2. Явно напиши **цель** (фича, баг, рефакторинг) и **ограничения** (не трогать X, совместимость с LM Studio и т.д.).
3. Попроси план: **какие файлы трогать**, **какие конфиги/промпты**, нужны ли **миграции БД**, как **проверить** (`npm run build`, ручной сценарий).
4. Для изменений пайплайна ориентируйся на **`pipeline.ts`**, для новой «роли» подзадачи — на **`roles.yaml`** и при необходимости новый YAML в **`config/agents/`** + агент в **`server/src/agents/`**.

---

## Текущие намерения разработки (заполняй вручную при необходимости)

_Ниже можно кратко дописывать актуальные цели, чтобы не терять контекст между сессиями._

- …

---

*Версия структуры: по состоянию репозитория AgentMOD (оркестратор, LM Studio, Mongo/SQLite, React Flow UI). При крупных изменениях обновляй этот файл.*
