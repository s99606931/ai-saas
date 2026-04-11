// SVC-AI-ADV-R14 단위 테스트: AI 워크플로우 오케스트레이터
// Design Ref: SVC-AI-ADV-R14 DESIGN §1~§3
// Plan SC: FR-ADV14.1~FR-ADV14.6
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  WorkflowEngine,
  createWorkflowEngine,
} from '../../src/lib/ai-workflow.js';
import type {
  WorkflowDefinition,
  WorkflowNodeDefinition,
} from '../../src/lib/ai-workflow.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

function createSimpleWorkflow(
  overrides: Partial<WorkflowDefinition> = {},
): WorkflowDefinition {
  return {
    id: 'wf-test-1',
    name: '테스트 워크플로우',
    nodes: [
      {
        id: 'node-a',
        name: '노드 A',
        dependencies: [],
        handler: vi.fn().mockResolvedValue({ result: 'A 완료' }),
      },
      {
        id: 'node-b',
        name: '노드 B',
        dependencies: ['node-a'],
        handler: vi.fn().mockResolvedValue({ result: 'B 완료' }),
      },
    ],
    ...overrides,
  };
}

function createParallelWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-parallel',
    name: '병렬 워크플로우',
    nodes: [
      {
        id: 'node-1',
        name: '노드 1',
        dependencies: [],
        handler: vi.fn().mockResolvedValue('결과 1'),
      },
      {
        id: 'node-2',
        name: '노드 2',
        dependencies: [],
        handler: vi.fn().mockResolvedValue('결과 2'),
      },
      {
        id: 'node-3',
        name: '병합 노드',
        dependencies: ['node-1', 'node-2'],
        handler: vi.fn().mockResolvedValue('병합 결과'),
      },
    ],
  };
}

// ── 기본 실행 테스트 — FR-ADV14.1, FR-ADV14.2 ──────────────────────────────

describe('WorkflowEngine 기본 실행 (FR-ADV14.1~14.2)', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('순차 워크플로우를 실행한다', async () => {
    const workflow = createSimpleWorkflow();
    const result = await engine.execute(workflow, {});

    expect(result.status).toBe('completed');
    expect(result.completedNodes).toBe(2);
    expect(result.failedNodes).toBe(0);
    expect(result.skippedNodes).toBe(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('노드 결과를 다음 노드에 전달한다', async () => {
    const nodeA: WorkflowNodeDefinition = {
      id: 'node-a',
      name: '노드 A',
      dependencies: [],
      handler: vi.fn().mockResolvedValue({ value: 42 }),
    };
    const nodeB: WorkflowNodeDefinition = {
      id: 'node-b',
      name: '노드 B',
      dependencies: ['node-a'],
      handler: vi.fn().mockImplementation((_input, ctx) => {
        return Promise.resolve({ received: ctx.results['node-a'] });
      }),
    };

    const workflow: WorkflowDefinition = {
      id: 'wf-chain',
      name: '체인 워크플로우',
      nodes: [nodeA, nodeB],
    };

    const result = await engine.execute(workflow, {});
    expect(result.status).toBe('completed');
    expect(result.results['node-b']).toEqual({ received: { value: 42 } });
  });

  it('DAG 토폴로지 정렬로 의존성을 해결한다', async () => {
    const workflow = createParallelWorkflow();
    const result = await engine.execute(workflow, {});

    expect(result.status).toBe('completed');
    expect(result.completedNodes).toBe(3);
    expect(result.results['node-3']).toBe('병합 결과');
  });

  it('입력 데이터를 노드에 전달한다', async () => {
    const handler = vi.fn().mockResolvedValue('ok');
    const workflow: WorkflowDefinition = {
      id: 'wf-input',
      name: '입력 테스트',
      nodes: [{ id: 'node-a', name: 'A', dependencies: [], handler }],
    };

    await engine.execute(workflow, { key: 'value' });

    expect(handler).toHaveBeenCalledWith(
      { key: 'value' },
      expect.objectContaining({ input: { key: 'value' } }),
    );
  });

  it('runId를 생성한다', async () => {
    const result = await engine.execute(createSimpleWorkflow(), {});
    expect(result.runId).toBeDefined();
    expect(result.runId.length).toBeGreaterThan(0);
  });

  it('workflowId를 결과에 포함한다', async () => {
    const result = await engine.execute(createSimpleWorkflow(), {});
    expect(result.workflowId).toBe('wf-test-1');
  });

  it('시작/완료 시각을 기록한다', async () => {
    const result = await engine.execute(createSimpleWorkflow(), {});
    expect(result.startedAt).toBeLessThanOrEqual(result.completedAt);
  });
});

// ── 조건부 분기 — FR-ADV14.3 ───────────────────────────────────────────────

describe('WorkflowEngine 조건부 분기 (FR-ADV14.3)', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('조건이 true이면 노드를 실행한다', async () => {
    const handler = vi.fn().mockResolvedValue('실행됨');
    const workflow: WorkflowDefinition = {
      id: 'wf-cond',
      name: '조건부',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler: vi.fn().mockResolvedValue({ flag: true }),
        },
        {
          id: 'node-b',
          name: 'B',
          dependencies: ['node-a'],
          condition: (results) => (results['node-a'] as { flag: boolean })?.flag === true,
          handler,
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.completedNodes).toBe(2);
    expect(handler).toHaveBeenCalled();
  });

  it('조건이 false이면 노드를 건너뛴다', async () => {
    const handler = vi.fn().mockResolvedValue('실행됨');
    const workflow: WorkflowDefinition = {
      id: 'wf-cond-skip',
      name: '조건부 스킵',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler: vi.fn().mockResolvedValue({ flag: false }),
        },
        {
          id: 'node-b',
          name: 'B',
          dependencies: ['node-a'],
          condition: (results) => (results['node-a'] as { flag: boolean })?.flag === true,
          handler,
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.skippedNodes).toBe(1);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── 재시도 정책 — FR-ADV14.4 ───────────────────────────────────────────────

describe('WorkflowEngine 재시도 (FR-ADV14.4)', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('실패한 노드를 재시도한다', async () => {
    let callCount = 0;
    const handler = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) throw new Error('일시적 오류');
      return Promise.resolve('성공');
    });

    const workflow: WorkflowDefinition = {
      id: 'wf-retry',
      name: '재시도',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler,
          retryPolicy: { maxRetries: 3, baseDelayMs: 1 },
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.status).toBe('completed');
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('최대 재시도 횟수를 초과하면 실패한다', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('지속적 오류'));
    const workflow: WorkflowDefinition = {
      id: 'wf-fail',
      name: '실패',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler,
          retryPolicy: { maxRetries: 2, baseDelayMs: 1 },
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.status).toBe('failed');
    expect(result.failedNodes).toBe(1);
    // 최초 시도 + 2회 재시도 = 3회
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('재시도 불가 에러는 즉시 실패한다', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('VALIDATION_ERROR: 잘못된 입력'));
    const workflow: WorkflowDefinition = {
      id: 'wf-non-retry',
      name: '재시도 불가',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler,
          retryPolicy: {
            maxRetries: 3,
            baseDelayMs: 1,
            nonRetryableErrors: ['VALIDATION_ERROR'],
          },
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.status).toBe('failed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('의존 노드 실패 시 후속 노드를 건너뛴다', async () => {
    const handlerB = vi.fn().mockResolvedValue('B');
    const workflow: WorkflowDefinition = {
      id: 'wf-dep-fail',
      name: '의존 실패',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler: vi.fn().mockRejectedValue(new Error('A 실패')),
          retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
        },
        {
          id: 'node-b',
          name: 'B',
          dependencies: ['node-a'],
          handler: handlerB,
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.failedNodes).toBe(1);
    expect(result.skippedNodes).toBe(1);
    expect(handlerB).not.toHaveBeenCalled();
  });
});

// ── 타임아웃 ────────────────────────────────────────────────────────────────

describe('WorkflowEngine 타임아웃', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('타임아웃 초과 시 노드가 실패한다', async () => {
    const slowHandler = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );

    const workflow: WorkflowDefinition = {
      id: 'wf-timeout',
      name: '타임아웃',
      nodes: [
        {
          id: 'node-slow',
          name: '느린 노드',
          dependencies: [],
          handler: slowHandler,
          timeoutMs: 50,
          retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
        },
      ],
    };

    const result = await engine.execute(workflow, {});
    expect(result.status).toBe('failed');
    const nodeState = result.nodeStates.get('node-slow');
    expect(nodeState?.error).toContain('타임아웃');
  });
});

// ── 체크포인트/재개 — FR-ADV14.5 ───────────────────────────────────────────

describe('WorkflowEngine 체크포인트 (FR-ADV14.5)', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('체크포인트에서 워크플로우를 재개한다', async () => {
    // 첫 실행: node-a 성공, node-b 실패
    let firstCall = true;
    const handlerB = vi.fn().mockImplementation(() => {
      if (firstCall) {
        firstCall = false;
        throw new Error('일시 장애');
      }
      return Promise.resolve('B 성공');
    });

    const workflow: WorkflowDefinition = {
      id: 'wf-checkpoint',
      name: '체크포인트 테스트',
      nodes: [
        {
          id: 'node-a',
          name: 'A',
          dependencies: [],
          handler: vi.fn().mockResolvedValue('A 결과'),
        },
        {
          id: 'node-b',
          name: 'B',
          dependencies: ['node-a'],
          handler: handlerB,
          retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
        },
      ],
    };

    // 첫 실행
    const firstResult = await engine.execute(workflow, { data: 'test' });
    expect(firstResult.status).toBe('failed');

    // 재개 - node-a는 체크포인트에서 복원, node-b만 재실행
    const resumed = await engine.resume(workflow, firstResult.runId);
    expect(resumed.status).toBe('completed');
    expect(resumed.completedNodes).toBe(2);
  });

  it('존재하지 않는 체크포인트로 resume하면 에러를 발생한다', async () => {
    await expect(
      engine.resume(createSimpleWorkflow(), 'nonexistent-run-id'),
    ).rejects.toThrow('체크포인트를 찾을 수 없습니다');
  });
});

// ── 메트릭 — FR-ADV14.6 ────────────────────────────────────────────────────

describe('WorkflowEngine 메트릭 (FR-ADV14.6)', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  it('초기 메트릭이 0이다', () => {
    const metrics = engine.getMetrics();
    expect(metrics.totalRuns).toBe(0);
    expect(metrics.completedRuns).toBe(0);
    expect(metrics.failedRuns).toBe(0);
    expect(metrics.avgDurationMs).toBe(0);
  });

  it('실행 후 메트릭을 집계한다', async () => {
    await engine.execute(createSimpleWorkflow(), {});
    await engine.execute(createSimpleWorkflow(), {});

    const metrics = engine.getMetrics();
    expect(metrics.totalRuns).toBe(2);
    expect(metrics.completedRuns).toBe(2);
    expect(metrics.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('실패한 실행을 집계한다', async () => {
    const failWorkflow: WorkflowDefinition = {
      id: 'wf-fail-metric',
      name: '실패 메트릭',
      nodes: [
        {
          id: 'node-fail',
          name: '실패',
          dependencies: [],
          handler: vi.fn().mockRejectedValue(new Error('오류')),
          retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
        },
      ],
    };

    await engine.execute(failWorkflow, {});
    const metrics = engine.getMetrics();
    expect(metrics.failedRuns).toBe(1);
  });

  it('노드별 메트릭을 기록한다', async () => {
    await engine.execute(createSimpleWorkflow(), {});

    const metrics = engine.getMetrics();
    expect(metrics.nodeMetrics['node-a']).toBeDefined();
    expect(metrics.nodeMetrics['node-a']?.totalRuns).toBe(1);
    expect(metrics.nodeMetrics['node-a']?.failureRate).toBe(0);
    expect(metrics.nodeMetrics['node-b']).toBeDefined();
  });

  it('노드 실패율을 계산한다', async () => {
    const failWorkflow: WorkflowDefinition = {
      id: 'wf-node-fail',
      name: '노드 실패율',
      nodes: [
        {
          id: 'node-x',
          name: 'X',
          dependencies: [],
          handler: vi.fn().mockRejectedValue(new Error('오류')),
          retryPolicy: { maxRetries: 0, baseDelayMs: 1 },
        },
      ],
    };

    await engine.execute(failWorkflow, {});
    const metrics = engine.getMetrics();
    expect(metrics.nodeMetrics['node-x']?.failureRate).toBe(1);
  });
});

// ── 팩토리 ──────────────────────────────────────────────────────────────────

describe('createWorkflowEngine 팩토리', () => {
  it('WorkflowEngine 인스턴스를 생성한다', () => {
    const engine = createWorkflowEngine();
    expect(engine).toBeInstanceOf(WorkflowEngine);
  });
});
