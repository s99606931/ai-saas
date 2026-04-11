// SVC-AI-ADV-R20 단위 테스트: 다중 에이전트 협업 프레임워크
// Design Ref: SVC-AI-ADV-R20 DESIGN §1~§5
// Plan SC: FR-ADV20.1~20.6
// CSAP: D-08 에이전트별 권한 분리, D-06 통신 감사 로깅
// N2SF: N-05 에이전트 간 O등급 데이터만 교환

import { describe, it, expect, beforeEach } from 'vitest';

import {
  AgentPool,
  Blackboard,
  findExecutableNodes,
  topologicalSort,
  majorityVote,
  weightedVote,
  decomposeTask,
  createCollaborationPlan,
} from '../../src/lib/multi-agent-collaboration.js';
import type {
  AgentProfile,
  DAGNode,
  VoteResult,
} from '../../src/lib/multi-agent-collaboration.js';

// ── AgentPool — Design §2 Worker 에이전트 풀 ──────────────────────────────

describe('AgentPool Worker 풀 (FR-ADV20.2)', () => {
  let pool: AgentPool;

  const agent1: AgentProfile = {
    id: 'agent-1',
    name: '조사 에이전트',
    skills: ['research', 'analysis'],
    model: 'sonnet',
    maxConcurrency: 3,
    priority: 1,
    currentLoad: 0,
  };

  const agent2: AgentProfile = {
    id: 'agent-2',
    name: '작성 에이전트',
    skills: ['writing', 'document'],
    model: 'sonnet',
    maxConcurrency: 2,
    priority: 2,
    currentLoad: 0,
  };

  const agent3: AgentProfile = {
    id: 'agent-3',
    name: '분석 에이전트',
    skills: ['analysis', 'data'],
    model: 'opus',
    maxConcurrency: 2,
    priority: 1,
    currentLoad: 0,
  };

  beforeEach(() => {
    pool = new AgentPool();
    pool.register(agent1);
    pool.register(agent2);
    pool.register(agent3);
  });

  it('에이전트를 등록한다', () => {
    expect(pool.size).toBe(3);
  });

  it('에이전트를 해제한다', () => {
    expect(pool.unregister('agent-1')).toBe(true);
    expect(pool.size).toBe(2);
  });

  it('존재하지 않는 에이전트 해제는 false', () => {
    expect(pool.unregister('nonexistent')).toBe(false);
  });

  it('스킬로 에이전트를 선택한다 (부하 분산)', () => {
    const selected = pool.selectBySkill('analysis');
    expect(selected).toBeDefined();
    expect(selected!.skills).toContain('analysis');
  });

  it('부하가 낮은 에이전트를 우선 선택한다', () => {
    pool.incrementLoad('agent-1');
    pool.incrementLoad('agent-1');
    const selected = pool.selectBySkill('analysis');
    // agent-3: currentLoad=0, agent-1: currentLoad=2 -> agent-3 선택
    expect(selected!.id).toBe('agent-3');
  });

  it('용량 초과 에이전트는 선택하지 않는다', () => {
    // agent-3 maxConcurrency=2 -> 2번 부하 증가 후 선택 불가
    pool.incrementLoad('agent-3');
    pool.incrementLoad('agent-3');
    const selected = pool.selectBySkill('analysis');
    expect(selected!.id).toBe('agent-1');
  });

  it('매칭 스킬이 없으면 undefined 반환', () => {
    expect(pool.selectBySkill('nonexistent')).toBeUndefined();
  });

  it('부하를 증가/감소시킨다', () => {
    pool.incrementLoad('agent-1');
    pool.incrementLoad('agent-1');
    pool.decrementLoad('agent-1');
    const list = pool.list();
    const a1 = list.find((a) => a.id === 'agent-1');
    expect(a1!.currentLoad).toBe(1);
  });

  it('부하가 0 미만으로 감소하지 않는다', () => {
    pool.decrementLoad('agent-1');
    const list = pool.list();
    const a1 = list.find((a) => a.id === 'agent-1');
    expect(a1!.currentLoad).toBe(0);
  });

  it('사용 가능 에이전트 수를 반환한다', () => {
    expect(pool.availableCount).toBe(3);
    pool.incrementLoad('agent-2');
    pool.incrementLoad('agent-2');
    expect(pool.availableCount).toBe(2); // agent-2 is full
  });

  it('전체 에이전트 목록을 반환한다', () => {
    const list = pool.list();
    expect(list).toHaveLength(3);
  });
});

// ── Blackboard — Design §3 공유 메모리 ─────────────────────────────────────

describe('Blackboard 공유 메모리 (FR-ADV20.3)', () => {
  let bb: Blackboard;

  beforeEach(() => {
    bb = new Blackboard();
  });

  it('값을 쓰고 읽는다', () => {
    bb.write('key1', 'value1', 'agent-1');
    const value = bb.read('key1', 'agent-1');
    expect(value).toBe('value1');
  });

  it('소유자가 아닌 에이전트는 읽을 수 없다 (CSAP D-08)', () => {
    bb.write('key1', 'secret', 'agent-1');
    const value = bb.read('key1', 'agent-2');
    expect(value).toBeUndefined();
  });

  it('명시적 읽기 권한이 있으면 읽을 수 있다', () => {
    bb.write('key1', 'shared', 'agent-1', ['agent-1', 'agent-2']);
    const value = bb.read('key1', 'agent-2');
    expect(value).toBe('shared');
  });

  it('버전을 증가시킨다 (낙관적 잠금)', () => {
    const v1 = bb.write('key1', 'v1', 'agent-1');
    expect(v1.version).toBe(1);
    const v2 = bb.write('key1', 'v2', 'agent-1');
    expect(v2.version).toBe(2);
  });

  it('소유자별 항목을 조회한다', () => {
    bb.write('k1', 'v1', 'agent-1');
    bb.write('k2', 'v2', 'agent-1');
    bb.write('k3', 'v3', 'agent-2');
    const entries = bb.getByOwner('agent-1');
    expect(entries).toHaveLength(2);
  });

  it('만료된 항목을 정리한다', () => {
    const entry = bb.write('k1', 'v1', 'agent-1');
    // 과거 시간으로 만료 설정
    entry.expiresAt = new Date(Date.now() - 1000).toISOString();
    const removed = bb.cleanup();
    expect(removed).toBe(1);
    expect(bb.size).toBe(0);
  });

  it('만료되지 않은 항목은 유지한다', () => {
    const entry = bb.write('k1', 'v1', 'agent-1');
    entry.expiresAt = new Date(Date.now() + 60000).toISOString();
    const removed = bb.cleanup();
    expect(removed).toBe(0);
    expect(bb.size).toBe(1);
  });

  it('전체 초기화한다', () => {
    bb.write('k1', 'v1', 'agent-1');
    bb.write('k2', 'v2', 'agent-2');
    bb.clear();
    expect(bb.size).toBe(0);
  });

  it('존재하지 않는 키는 undefined 반환', () => {
    expect(bb.read('nonexistent', 'agent-1')).toBeUndefined();
  });
});

// ── DAG 실행 — Design §4 ──────────────────────────────────────────────────

describe('findExecutableNodes DAG 실행 (FR-ADV20.4)', () => {
  const nodes: DAGNode[] = [
    { agentId: 'a1', taskId: 't1', inputs: [], outputs: ['t2', 't3'] },
    { agentId: 'a2', taskId: 't2', inputs: ['t1'], outputs: ['t4'] },
    { agentId: 'a3', taskId: 't3', inputs: ['t1'], outputs: ['t4'] },
    { agentId: 'a4', taskId: 't4', inputs: ['t2', 't3'], outputs: [] },
  ];

  it('의존성 없는 노드를 찾는다', () => {
    const executable = findExecutableNodes(nodes, new Set(), new Set());
    expect(executable).toHaveLength(1);
    expect(executable[0]!.taskId).toBe('t1');
  });

  it('의존 노드 완료 후 다음 노드를 찾는다', () => {
    const completed = new Set(['t1']);
    const executable = findExecutableNodes(nodes, completed, new Set());
    expect(executable).toHaveLength(2);
    const taskIds = executable.map((n) => n.taskId);
    expect(taskIds).toContain('t2');
    expect(taskIds).toContain('t3');
  });

  it('실행 중인 노드를 건너뛴다', () => {
    const completed = new Set(['t1']);
    const running = new Set(['t2']);
    const executable = findExecutableNodes(nodes, completed, running);
    expect(executable).toHaveLength(1);
    expect(executable[0]!.taskId).toBe('t3');
  });

  it('모든 의존이 완료되어야 실행 가능하다', () => {
    const completed = new Set(['t1', 't2']); // t3은 미완료
    const executable = findExecutableNodes(nodes, completed, new Set());
    // t4는 t2, t3 모두 필요 -> t3만 실행 가능
    const taskIds = executable.map((n) => n.taskId);
    expect(taskIds).toContain('t3');
    expect(taskIds).not.toContain('t4');
  });
});

describe('topologicalSort 위상 정렬', () => {
  it('올바른 실행 순서를 생성한다', () => {
    const nodes: DAGNode[] = [
      { agentId: 'a1', taskId: 't1', inputs: [], outputs: [] },
      { agentId: 'a2', taskId: 't2', inputs: ['t1'], outputs: [] },
      { agentId: 'a3', taskId: 't3', inputs: ['t2'], outputs: [] },
    ];

    const sorted = topologicalSort(nodes);
    const order = sorted.map((n) => n.taskId);
    expect(order.indexOf('t1')).toBeLessThan(order.indexOf('t2'));
    expect(order.indexOf('t2')).toBeLessThan(order.indexOf('t3'));
  });

  it('순환 의존성을 감지한다', () => {
    const nodes: DAGNode[] = [
      { agentId: 'a1', taskId: 't1', inputs: ['t2'], outputs: [] },
      { agentId: 'a2', taskId: 't2', inputs: ['t1'], outputs: [] },
    ];

    expect(() => topologicalSort(nodes)).toThrow('순환 의존성');
  });

  it('독립 노드를 처리한다', () => {
    const nodes: DAGNode[] = [
      { agentId: 'a1', taskId: 't1', inputs: [], outputs: [] },
      { agentId: 'a2', taskId: 't2', inputs: [], outputs: [] },
    ];

    const sorted = topologicalSort(nodes);
    expect(sorted).toHaveLength(2);
  });

  it('빈 노드 목록을 처리한다', () => {
    const sorted = topologicalSort([]);
    expect(sorted).toHaveLength(0);
  });
});

// ── 합의 프로토콜 — Design §5 ──────────────────────────────────────────────

describe('majorityVote 다수결 합의 (FR-ADV20.5)', () => {
  it('다수결로 승자를 결정한다', () => {
    const votes: VoteResult[] = [
      { agentId: 'a1', response: '답변 A', confidence: 0.9, reasoning: '이유 1' },
      { agentId: 'a2', response: '답변 A', confidence: 0.8, reasoning: '이유 2' },
      { agentId: 'a3', response: '답변 B', confidence: 0.7, reasoning: '이유 3' },
    ];

    const result = majorityVote(votes);
    expect(result.winner).toBe('답변 A');
    expect(result.method).toBe('majority');
    expect(result.agreement).toBeCloseTo(2 / 3, 2);
    expect(result.rounds).toBe(1);
  });

  it('빈 투표는 빈 승자를 반환한다', () => {
    const result = majorityVote([]);
    expect(result.winner).toBe('');
    expect(result.agreement).toBe(0);
  });

  it('단일 투표는 해당 응답이 승자이다', () => {
    const votes: VoteResult[] = [
      { agentId: 'a1', response: '유일한 답변', confidence: 0.9, reasoning: '' },
    ];
    const result = majorityVote(votes);
    expect(result.winner).toBe('유일한 답변');
    expect(result.agreement).toBe(1);
  });
});

describe('weightedVote 가중 투표 합의', () => {
  it('신뢰도 가중 점수로 승자를 결정한다', () => {
    const votes: VoteResult[] = [
      { agentId: 'a1', response: '답변 A', confidence: 0.3, reasoning: '' },
      { agentId: 'a2', response: '답변 B', confidence: 0.9, reasoning: '' },
      { agentId: 'a3', response: '답변 A', confidence: 0.2, reasoning: '' },
    ];

    const result = weightedVote(votes);
    // A: 0.3 + 0.2 = 0.5, B: 0.9 -> B 승리
    expect(result.winner).toBe('답변 B');
    expect(result.method).toBe('weighted');
  });

  it('빈 투표는 빈 승자를 반환한다', () => {
    const result = weightedVote([]);
    expect(result.winner).toBe('');
    expect(result.agreement).toBe(0);
  });

  it('동일 응답은 신뢰도를 합산한다', () => {
    const votes: VoteResult[] = [
      { agentId: 'a1', response: '답변', confidence: 0.5, reasoning: '' },
      { agentId: 'a2', response: '답변', confidence: 0.5, reasoning: '' },
    ];
    const result = weightedVote(votes);
    expect(result.winner).toBe('답변');
    expect(result.agreement).toBe(1);
  });
});

// ── Supervisor — Design §1 작업 분해 ──────────────────────────────────────

describe('decomposeTask 작업 분해 (FR-ADV20.1)', () => {
  it('법령 관련 작업을 분해한다', () => {
    const tasks = decomposeTask('전자정부법 규정 분석');
    const regTask = tasks.find((t) => t.description.includes('법령'));
    expect(regTask).toBeDefined();
    expect(regTask!.dependsOn).toHaveLength(0);
  });

  it('분석 작업을 분해한다', () => {
    const tasks = decomposeTask('현황 분석 보고서');
    const analysisTask = tasks.find((t) => t.description.includes('분석'));
    expect(analysisTask).toBeDefined();
  });

  it('문서 작업을 분해한다', () => {
    const tasks = decomposeTask('보고서 작성');
    const docTask = tasks.find((t) => t.description.includes('문서') || t.description.includes('보고서'));
    expect(docTask).toBeDefined();
  });

  it('키워드 없는 요청은 기본 작업을 생성한다', () => {
    const tasks = decomposeTask('일반 질문');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.description).toContain('요청 처리');
  });

  it('복합 작업은 여러 하위 작업을 생성한다', () => {
    const tasks = decomposeTask('법령 분석 후 보고서 작성');
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('하위 작업 ID가 고유하다', () => {
    const tasks = decomposeTask('규정 분석 보고서 작성');
    const ids = tasks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('의존성이 올바르게 설정된다', () => {
    const tasks = decomposeTask('규정 분석 보고서 작성');
    // 문서 작업은 이전 작업에 의존
    const docTask = tasks.find((t) => t.description.includes('문서') || t.description.includes('보고서'));
    if (docTask && tasks.length > 1) {
      expect(docTask.dependsOn.length).toBeGreaterThan(0);
    }
  });
});

describe('createCollaborationPlan 협업 계획 생성', () => {
  it('협업 계획을 생성한다', () => {
    const plan = createCollaborationPlan('법령 검토 요청');
    expect(plan.id).toMatch(/^collab-/);
    expect(plan.originalQuery).toBe('법령 검토 요청');
    expect(plan.status).toBe('planning');
    expect(plan.subtasks.length).toBeGreaterThan(0);
    expect(plan.createdAt).toBeDefined();
  });
});
