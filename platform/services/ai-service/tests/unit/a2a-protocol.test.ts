// SVC-AI-ADV-R17 단위 테스트: A2A 프로토콜 (Agent-to-Agent)
// Design Ref: SVC-AI-ADV-R17 DESIGN §1~§6
// Plan SC: FR-ADV17.1~17.6
// CSAP: D-08 에이전트 인증, D-12 입력 검증, D-06 감사 로깅
// N2SF: N-05 에이전트 간 O등급 데이터만 교환

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createAgentCard,
  TaskStore,
  AgentRegistry,
  handleJSONRPC,
  taskSendSchema,
  taskGetSchema,
  taskCancelSchema,
} from '../../src/lib/a2a-protocol.js';
import type {
  AgentCard,
  AgentSkill,
  A2ATask,
  JSONRPCRequest,
} from '../../src/lib/a2a-protocol.js';

// ── 입력 검증 스키마 ───────────────────────────────────────────────────────

describe('A2A 입력 검증 스키마 (CSAP D-12)', () => {
  it('taskSendSchema: 유효한 요청을 허용한다', () => {
    const result = taskSendSchema.safeParse({ message: '작업 요청' });
    expect(result.success).toBe(true);
  });

  it('taskSendSchema: 빈 메시지를 거부한다', () => {
    const result = taskSendSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('taskSendSchema: sessionId와 callbackUrl을 허용한다', () => {
    const result = taskSendSchema.safeParse({
      message: '작업',
      sessionId: 'sess-1',
      callbackUrl: 'https://example.com/callback',
    });
    expect(result.success).toBe(true);
  });

  it('taskSendSchema: 잘못된 callbackUrl을 거부한다', () => {
    const result = taskSendSchema.safeParse({
      message: '작업',
      callbackUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('taskGetSchema: 유효한 taskId를 허용한다', () => {
    const result = taskGetSchema.safeParse({ taskId: 'task-123' });
    expect(result.success).toBe(true);
  });

  it('taskGetSchema: 빈 taskId를 거부한다', () => {
    const result = taskGetSchema.safeParse({ taskId: '' });
    expect(result.success).toBe(false);
  });

  it('taskCancelSchema: reason을 선택적으로 허용한다', () => {
    const result = taskCancelSchema.safeParse({
      taskId: 'task-123',
      reason: '더 이상 필요하지 않음',
    });
    expect(result.success).toBe(true);
  });
});

// ── Agent Card — Design §1 ─────────────────────────────────────────────────

describe('createAgentCard Agent Card 생성 (FR-ADV17.1)', () => {
  it('기본 Agent Card를 생성한다', () => {
    const skills: AgentSkill[] = [{
      id: 'skill-1',
      name: '문서 분석',
      description: '공문서를 분석합니다',
      inputModes: ['text', 'file'],
      outputModes: ['text', 'data'],
      tags: ['document', 'analysis'],
    }];

    const card = createAgentCard({
      name: '문서분석 에이전트',
      description: '공공기관 문서 분석',
      version: '1.0.0',
      url: 'https://agent.example.com',
      skills,
    });

    expect(card.name).toBe('문서분석 에이전트');
    expect(card.provider).toBe('공공기관 SaaS 프레임워크');
    expect(card.authentication.type).toBe('bearer');
    expect(card.authentication.required).toBe(true);
    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.maxConcurrentTasks).toBe(10);
    expect(card.skills).toHaveLength(1);
  });
});

// ── TaskStore — Design §2 태스크 생명주기 ──────────────────────────────────

describe('TaskStore 태스크 생명주기 (FR-ADV17.2)', () => {
  let store: TaskStore;

  beforeEach(() => {
    store = new TaskStore();
  });

  it('태스크를 생성한다', () => {
    const task = store.create('문서를 분석해주세요');
    expect(task.id).toMatch(/^task-/);
    expect(task.state).toBe('submitted');
    expect(task.messages).toHaveLength(1);
    expect(task.messages[0]!.role).toBe('user');
    expect(task.messages[0]!.content).toBe('문서를 분석해주세요');
    expect(task.artifacts).toHaveLength(0);
    expect(store.size).toBe(1);
  });

  it('sessionId를 설정할 수 있다', () => {
    const task = store.create('작업', 'sess-1');
    expect(task.sessionId).toBe('sess-1');
  });

  it('callbackUrl을 설정할 수 있다', () => {
    const task = store.create('작업', undefined, 'https://callback.example.com');
    expect(task.callbackUrl).toBe('https://callback.example.com');
  });

  it('태스크를 조회한다', () => {
    const created = store.create('작업');
    const found = store.get(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it('존재하지 않는 태스크는 undefined를 반환한다', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('유효한 상태 전이: submitted -> working', () => {
    const task = store.create('작업');
    const updated = store.transition(task.id, 'working');
    expect(updated).toBeDefined();
    expect(updated!.state).toBe('working');
  });

  it('유효한 상태 전이: working -> completed', () => {
    const task = store.create('작업');
    store.transition(task.id, 'working');
    const updated = store.transition(task.id, 'completed');
    expect(updated).toBeDefined();
    expect(updated!.state).toBe('completed');
  });

  it('유효한 상태 전이: submitted -> canceled', () => {
    const task = store.create('작업');
    const updated = store.transition(task.id, 'canceled');
    expect(updated).toBeDefined();
    expect(updated!.state).toBe('canceled');
  });

  it('유효한 상태 전이: working -> input-required', () => {
    const task = store.create('작업');
    store.transition(task.id, 'working');
    const updated = store.transition(task.id, 'input-required');
    expect(updated).toBeDefined();
    expect(updated!.state).toBe('input-required');
  });

  it('잘못된 상태 전이를 거부한다: completed -> working', () => {
    const task = store.create('작업');
    store.transition(task.id, 'working');
    store.transition(task.id, 'completed');
    const result = store.transition(task.id, 'working');
    expect(result).toBeUndefined();
  });

  it('잘못된 상태 전이를 거부한다: canceled -> working', () => {
    const task = store.create('작업');
    store.transition(task.id, 'canceled');
    const result = store.transition(task.id, 'working');
    expect(result).toBeUndefined();
  });

  it('에이전트 응답을 추가한다', () => {
    const task = store.create('질문');
    const updated = store.addAgentMessage(task.id, '답변입니다');
    expect(updated).toBeDefined();
    expect(updated!.messages).toHaveLength(2);
    expect(updated!.messages[1]!.role).toBe('agent');
    expect(updated!.messages[1]!.content).toBe('답변입니다');
  });

  it('아티팩트를 추가한다', () => {
    const task = store.create('작업');
    const updated = store.addArtifact(task.id, {
      name: '보고서.pdf',
      type: 'file',
      mimeType: 'application/pdf',
      content: 'base64content',
    });
    expect(updated).toBeDefined();
    expect(updated!.artifacts).toHaveLength(1);
    expect(updated!.artifacts[0]!.name).toBe('보고서.pdf');
  });

  it('존재하지 않는 태스크에 메시지 추가는 undefined', () => {
    expect(store.addAgentMessage('none', 'msg')).toBeUndefined();
  });

  it('존재하지 않는 태스크에 아티팩트 추가는 undefined', () => {
    expect(store.addArtifact('none', { name: 'f', type: 'text', mimeType: 'text/plain', content: '' })).toBeUndefined();
  });
});

// ── JSON-RPC 디스패처 — Design §2 ──────────────────────────────────────────

describe('handleJSONRPC 디스패처 (FR-ADV17.2)', () => {
  let store: TaskStore;

  beforeEach(() => {
    store = new TaskStore();
  });

  it('tasks/send로 태스크를 생성한다', () => {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tasks/send',
      params: { message: '작업 요청' },
      id: 1,
    };
    const response = handleJSONRPC(request, store);
    expect(response.result).toBeDefined();
    expect((response.result as A2ATask).state).toBe('submitted');
    expect(store.size).toBe(1);
  });

  it('tasks/send 유효하지 않은 파라미터를 거부한다', () => {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tasks/send',
      params: { message: '' },
      id: 2,
    };
    const response = handleJSONRPC(request, store);
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32602);
  });

  it('tasks/get로 태스크를 조회한다', () => {
    const task = store.create('작업');
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { taskId: task.id },
      id: 3,
    };
    const response = handleJSONRPC(request, store);
    expect(response.result).toBeDefined();
    expect((response.result as A2ATask).id).toBe(task.id);
  });

  it('tasks/get 존재하지 않는 태스크는 에러를 반환한다', () => {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tasks/get',
      params: { taskId: 'nonexistent' },
      id: 4,
    };
    const response = handleJSONRPC(request, store);
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32001);
  });

  it('tasks/cancel로 태스크를 취소한다', () => {
    const task = store.create('작업');
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tasks/cancel',
      params: { taskId: task.id },
      id: 5,
    };
    const response = handleJSONRPC(request, store);
    expect(response.result).toBeDefined();
    expect((response.result as A2ATask).state).toBe('canceled');
  });

  it('지원하지 않는 메서드는 에러를 반환한다', () => {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tasks/unknown',
      params: {},
      id: 6,
    };
    const response = handleJSONRPC(request, store);
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
  });
});

// ── AgentRegistry — Design §6 ──────────────────────────────────────────────

describe('AgentRegistry 에이전트 레지스트리 (FR-ADV17.6)', () => {
  let registry: AgentRegistry;

  const mockCard: AgentCard = {
    name: '문서분석 에이전트',
    description: '공문서 분석',
    version: '1.0.0',
    provider: '공공기관',
    url: 'https://agent.example.com',
    skills: [{
      id: 's1',
      name: '문서 분석',
      description: '분석',
      inputModes: ['text'],
      outputModes: ['data'],
      tags: ['document', 'analysis'],
    }],
    authentication: { type: 'bearer', required: true },
    capabilities: { streaming: true, pushNotifications: false, maxConcurrentTasks: 5 },
  };

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('에이전트를 등록한다', () => {
    registry.register(mockCard);
    expect(registry.size).toBe(1);
  });

  it('에이전트를 이름으로 조회한다', () => {
    registry.register(mockCard);
    const found = registry.get('문서분석 에이전트');
    expect(found).toBeDefined();
    expect(found!.version).toBe('1.0.0');
  });

  it('존재하지 않는 에이전트는 undefined를 반환한다', () => {
    expect(registry.get('없는 에이전트')).toBeUndefined();
  });

  it('에이전트를 해제한다', () => {
    registry.register(mockCard);
    const removed = registry.unregister('문서분석 에이전트');
    expect(removed).toBe(true);
    expect(registry.size).toBe(0);
  });

  it('존재하지 않는 에이전트 해제는 false를 반환한다', () => {
    expect(registry.unregister('없음')).toBe(false);
  });

  it('스킬 태그로 에이전트를 검색한다', () => {
    registry.register(mockCard);
    registry.register({
      ...mockCard,
      name: '번역 에이전트',
      skills: [{
        id: 's2',
        name: '번역',
        description: '번역',
        inputModes: ['text'],
        outputModes: ['text'],
        tags: ['translation'],
      }],
    });

    const docAgents = registry.findBySkill('document');
    expect(docAgents).toHaveLength(1);
    expect(docAgents[0]!.name).toBe('문서분석 에이전트');

    const transAgents = registry.findBySkill('translation');
    expect(transAgents).toHaveLength(1);
  });

  it('매칭 스킬이 없으면 빈 배열을 반환한다', () => {
    registry.register(mockCard);
    const results = registry.findBySkill('nonexistent');
    expect(results).toHaveLength(0);
  });

  it('전체 에이전트 목록을 반환한다', () => {
    registry.register(mockCard);
    registry.register({ ...mockCard, name: '에이전트2' });
    const list = registry.list();
    expect(list).toHaveLength(2);
  });
});
