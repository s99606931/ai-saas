// A2A 프로토콜 (Agent-to-Agent 상호운용) — FR-ADV17.1~17.6
// Design Ref: SVC-AI-ADV-R17 DESIGN §1~§6
// Plan SC: SC-1 (Agent Card), SC-2 (Task Lifecycle), SC-3 (SSE), SC-4 (Artifact)
// CSAP: D-08 에이전트 인증, D-12 입력 검증, D-06 감사 로깅
// N2SF: N-05 에이전트 간 O등급 데이터만 교환

import { z } from 'zod';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 에이전트 능력 — Design §1 */
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputModes: Array<'text' | 'file' | 'data'>;
  outputModes: Array<'text' | 'file' | 'data'>;
  tags: string[];
}

/** Agent Card — /.well-known/agent.json */
export interface AgentCard {
  name: string;
  description: string;
  version: string;
  provider: string;
  url: string;
  skills: AgentSkill[];
  authentication: {
    type: 'bearer' | 'api_key' | 'none';
    required: boolean;
  };
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    maxConcurrentTasks: number;
  };
}

/** A2A 태스크 상태 — Design §2 */
export type TaskState = 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled';

/** 태스크 메시지 */
export interface TaskMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

/** 아티팩트 — Design §4 */
export interface TaskArtifact {
  name: string;
  type: 'text' | 'file' | 'data';
  mimeType: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** A2A 태스크 */
export interface A2ATask {
  id: string;
  sessionId?: string;
  state: TaskState;
  messages: TaskMessage[];
  artifacts: TaskArtifact[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  callbackUrl?: string;
}

/** SSE 이벤트 — Design §3 */
export interface TaskStatusUpdateEvent {
  type: 'status';
  taskId: string;
  state: TaskState;
  message?: string;
  timestamp: string;
}

export interface TaskArtifactUpdateEvent {
  type: 'artifact';
  taskId: string;
  artifact: TaskArtifact;
  timestamp: string;
}

export type A2AEvent = TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/** JSON-RPC 2.0 요청 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

/** JSON-RPC 2.0 응답 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

// ── 입력 검증 스키마 ────────────────────────────────────────────────────────

export const taskSendSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
});

export const taskGetSchema = z.object({
  taskId: z.string().min(1).max(100),
});

export const taskCancelSchema = z.object({
  taskId: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
});

// ── Agent Card 생성 — Design §1 ─────────────────────────────────────────────

/** 기본 Agent Card 생성 */
export function createAgentCard(config: {
  name: string;
  description: string;
  version: string;
  url: string;
  skills: AgentSkill[];
}): AgentCard {
  return {
    name: config.name,
    description: config.description,
    version: config.version,
    provider: '공공기관 SaaS 프레임워크',
    url: config.url,
    skills: config.skills,
    authentication: {
      type: 'bearer',
      required: true,
    },
    capabilities: {
      streaming: true,
      pushNotifications: true,
      maxConcurrentTasks: 10,
    },
  };
}

// ── Task Lifecycle — Design §2 ──────────────────────────────────────────────

/** 태스크 저장소 */
export class TaskStore {
  private readonly tasks: Map<string, A2ATask> = new Map();

  /** 태스크 생성 */
  create(message: string, sessionId?: string, callbackUrl?: string): A2ATask {
    const now = new Date().toISOString();
    const task: A2ATask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      state: 'submitted',
      messages: [{
        role: 'user',
        content: message,
        timestamp: now,
      }],
      artifacts: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
      callbackUrl,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /** 태스크 조회 */
  get(taskId: string): A2ATask | undefined {
    return this.tasks.get(taskId);
  }

  /** 상태 전이 */
  transition(taskId: string, newState: TaskState): A2ATask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    // 유효한 상태 전이 검증
    if (!isValidTransition(task.state, newState)) {
      return undefined;
    }

    task.state = newState;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  /** 에이전트 응답 추가 */
  addAgentMessage(taskId: string, content: string): A2ATask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    task.messages.push({
      role: 'agent',
      content,
      timestamp: new Date().toISOString(),
    });
    task.updatedAt = new Date().toISOString();
    return task;
  }

  /** 아티팩트 추가 */
  addArtifact(taskId: string, artifact: TaskArtifact): A2ATask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    task.artifacts.push(artifact);
    task.updatedAt = new Date().toISOString();
    return task;
  }

  /** 태스크 수 */
  get size(): number {
    return this.tasks.size;
  }
}

// ── 상태 전이 검증 ─────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  'submitted': ['working', 'canceled', 'failed'],
  'working': ['completed', 'failed', 'canceled', 'input-required'],
  'input-required': ['working', 'canceled', 'failed'],
  'completed': [],
  'failed': [],
  'canceled': [],
};

function isValidTransition(from: TaskState, to: TaskState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

// ── JSON-RPC 디스패처 — Design §2 ──────────────────────────────────────────

/** JSON-RPC 요청 처리 */
export function handleJSONRPC(
  request: JSONRPCRequest,
  taskStore: TaskStore,
  executor?: (task: A2ATask) => Promise<void>,
): JSONRPCResponse {
  switch (request.method) {
    case 'tasks/send': {
      const parsed = taskSendSchema.safeParse(request.params);
      if (!parsed.success) {
        return {
          jsonrpc: '2.0',
          error: { code: -32602, message: '유효하지 않은 매개변수', data: parsed.error.format() },
          id: request.id,
        };
      }
      const task = taskStore.create(
        parsed.data.message,
        parsed.data.sessionId,
        parsed.data.callbackUrl,
      );
      // 비동기 실행 시작 (fire-and-forget)
      if (executor) {
        void executor(task);
      }
      return {
        jsonrpc: '2.0',
        result: task,
        id: request.id,
      };
    }

    case 'tasks/get': {
      const parsed = taskGetSchema.safeParse(request.params);
      if (!parsed.success) {
        return {
          jsonrpc: '2.0',
          error: { code: -32602, message: '유효하지 않은 매개변수' },
          id: request.id,
        };
      }
      const task = taskStore.get(parsed.data.taskId);
      if (!task) {
        return {
          jsonrpc: '2.0',
          error: { code: -32001, message: '태스크를 찾을 수 없습니다' },
          id: request.id,
        };
      }
      return { jsonrpc: '2.0', result: task, id: request.id };
    }

    case 'tasks/cancel': {
      const parsed = taskCancelSchema.safeParse(request.params);
      if (!parsed.success) {
        return {
          jsonrpc: '2.0',
          error: { code: -32602, message: '유효하지 않은 매개변수' },
          id: request.id,
        };
      }
      const task = taskStore.transition(parsed.data.taskId, 'canceled');
      if (!task) {
        return {
          jsonrpc: '2.0',
          error: { code: -32001, message: '태스크 취소 실패' },
          id: request.id,
        };
      }
      return { jsonrpc: '2.0', result: task, id: request.id };
    }

    default:
      return {
        jsonrpc: '2.0',
        error: { code: -32601, message: `지원하지 않는 메서드: ${request.method}` },
        id: request.id,
      };
  }
}

// ── 에이전트 레지스트리 — Design §6 ─────────────────────────────────────────

/** 에이전트 레지스트리 */
export class AgentRegistry {
  private readonly agents: Map<string, AgentCard> = new Map();

  /** 에이전트 등록 */
  register(card: AgentCard): void {
    this.agents.set(card.name, card);
  }

  /** 에이전트 해제 */
  unregister(name: string): boolean {
    return this.agents.delete(name);
  }

  /** 이름으로 조회 */
  get(name: string): AgentCard | undefined {
    return this.agents.get(name);
  }

  /** 스킬 기반 검색 */
  findBySkill(tag: string): AgentCard[] {
    const results: AgentCard[] = [];
    for (const card of this.agents.values()) {
      const hasSkill = card.skills.some((s) => s.tags.includes(tag));
      if (hasSkill) {
        results.push(card);
      }
    }
    return results;
  }

  /** 전체 에이전트 목록 */
  list(): AgentCard[] {
    return [...this.agents.values()];
  }

  /** 등록 수 */
  get size(): number {
    return this.agents.size;
  }
}
