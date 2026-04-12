// Saga 테스트
// Plan SC: FR-SAGA.1~FR-SAGA.10
// Design Ref: docs/02-design/mtus/SVC-SAGA-R44.design.md §테스트 계획

import { describe, it, expect, vi } from 'vitest';
import {
  Saga,
  MemorySagaStore,
  SagaExecutionError,
  type SagaDefinition,
  type SagaTransitionEvent,
} from '../src/saga.js';

interface Ctx {
  log: string[];
}

function newCtx(): Ctx {
  return { log: [] };
}

describe('FR-SAGA.2: 완료 경로', () => {
  it('단일 단계 성공 시 completed 상태', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-single',
      steps: [
        {
          name: 'step1',
          execute: async (ctx) => {
            ctx.log.push('step1');
          },
        },
      ],
    };
    const state = await saga.execute(def, newCtx());
    expect(state.status).toBe('completed');
    expect(state.completedSteps).toEqual(['step1']);
    expect(state.context.log).toEqual(['step1']);
  });

  it('3단계 모두 성공 시 completedSteps 순서 보장', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-3ok',
      steps: ['a', 'b', 'c'].map((n) => ({
        name: n,
        execute: async (ctx) => {
          ctx.log.push(n);
        },
      })),
    };
    const state = await saga.execute(def, newCtx());
    expect(state.status).toBe('completed');
    expect(state.completedSteps).toEqual(['a', 'b', 'c']);
    expect(state.context.log).toEqual(['a', 'b', 'c']);
  });
});

describe('FR-SAGA.3: 역순 보상', () => {
  it('2단계 중 2번째 실패 → 1번째 보상 호출', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-2fail',
      steps: [
        {
          name: 's1',
          execute: async (ctx) => {
            ctx.log.push('s1');
          },
          compensate: async (ctx) => {
            ctx.log.push('s1.comp');
          },
        },
        {
          name: 's2',
          execute: async () => {
            throw new Error('boom');
          },
        },
      ],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow(
      SagaExecutionError,
    );
    const state = await saga.getState('saga-2fail');
    expect(state?.status).toBe('compensated');
    expect(state?.context.log).toEqual(['s1', 's1.comp']);
    expect(state?.compensatedSteps).toEqual(['s1']);
  });

  it('3단계 중 3번째 실패 → 2,1 역순 보상', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-3fail',
      steps: [
        {
          name: 's1',
          execute: async (ctx) => {
            ctx.log.push('s1');
          },
          compensate: async (ctx) => {
            ctx.log.push('c1');
          },
        },
        {
          name: 's2',
          execute: async (ctx) => {
            ctx.log.push('s2');
          },
          compensate: async (ctx) => {
            ctx.log.push('c2');
          },
        },
        {
          name: 's3',
          execute: async () => {
            throw new Error('fail');
          },
        },
      ],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow(
      SagaExecutionError,
    );
    const state = await saga.getState('saga-3fail');
    expect(state?.context.log).toEqual(['s1', 's2', 'c2', 'c1']);
    expect(state?.compensatedSteps).toEqual(['s2', 's1']);
  });

  it('compensate 미정의 단계는 스킵', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-skip',
      steps: [
        {
          name: 's1',
          execute: async (ctx) => {
            ctx.log.push('s1');
          },
          compensate: async (ctx) => {
            ctx.log.push('c1');
          },
        },
        {
          name: 's2',
          execute: async (ctx) => {
            ctx.log.push('s2');
          },
          // 보상 없음
        },
        {
          name: 's3',
          execute: async () => {
            throw new Error('x');
          },
        },
      ],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow();
    const state = await saga.getState('saga-skip');
    expect(state?.context.log).toEqual(['s1', 's2', 'c1']);
    expect(state?.compensatedSteps).toEqual(['s1']);
  });
});

describe('FR-SAGA.4: 보상 결과 전이', () => {
  it('보상 성공 → compensated', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-comp-ok',
      steps: [
        {
          name: 's1',
          execute: async () => {},
          compensate: async () => {},
        },
        {
          name: 's2',
          execute: async () => {
            throw new Error('e');
          },
        },
      ],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow();
    const state = await saga.getState('saga-comp-ok');
    expect(state?.status).toBe('compensated');
  });

  it('보상 실패 → failed_compensation + 에러 집계', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-comp-fail',
      steps: [
        {
          name: 's1',
          execute: async () => {},
          compensate: async () => {
            throw new Error('cannot undo');
          },
        },
        {
          name: 's2',
          execute: async () => {
            throw new Error('primary');
          },
        },
      ],
    };
    try {
      await saga.execute(def, newCtx());
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SagaExecutionError);
      const sErr = err as SagaExecutionError;
      expect(sErr.status).toBe('failed_compensation');
      expect(sErr.compensationFailures).toHaveLength(1);
      expect(sErr.compensationFailures[0]!.step).toBe('s1');
      expect(sErr.cause.message).toBe('primary');
    }
    const state = await saga.getState('saga-comp-fail');
    expect(state?.status).toBe('failed_compensation');
    expect(state?.compensationError).toContain('cannot undo');
  });
});

describe('FR-SAGA.5: onTransition 훅', () => {
  it('모든 이벤트가 순서대로 방출', async () => {
    const events: SagaTransitionEvent[] = [];
    const saga = new Saga<Ctx>({
      onTransition: (e) => events.push(e),
    });
    const def: SagaDefinition<Ctx> = {
      id: 'saga-hook',
      steps: [
        {
          name: 'a',
          execute: async () => {},
          compensate: async () => {},
        },
        {
          name: 'b',
          execute: async () => {
            throw new Error('bad');
          },
        },
      ],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow();
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'start',
      'step_ok',
      'step_fail',
      'compensate_ok',
      'end',
    ]);
  });

  it('훅에서 예외가 나도 Saga는 계속 진행', async () => {
    const saga = new Saga<Ctx>({
      onTransition: () => {
        throw new Error('hook broken');
      },
    });
    const def: SagaDefinition<Ctx> = {
      id: 'saga-hook-err',
      steps: [{ name: 's1', execute: async () => {} }],
    };
    const state = await saga.execute(def, newCtx());
    expect(state.status).toBe('completed');
  });
});

describe('FR-SAGA.6: 컨텍스트 공유', () => {
  it('step1 결과가 step2에서 사용 가능', async () => {
    interface Flow {
      a?: number;
      b?: number;
    }
    const saga = new Saga<Flow>();
    const def: SagaDefinition<Flow> = {
      id: 'saga-ctx',
      steps: [
        {
          name: 's1',
          execute: async (ctx) => {
            ctx.a = 10;
          },
        },
        {
          name: 's2',
          execute: async (ctx) => {
            ctx.b = (ctx.a ?? 0) * 2;
          },
        },
      ],
    };
    const state = await saga.execute(def, {});
    expect(state.context.a).toBe(10);
    expect(state.context.b).toBe(20);
  });
});

describe('FR-SAGA.7: 타임아웃', () => {
  it('타임아웃 초과 시 실패 + 보상 호출', async () => {
    const saga = new Saga<Ctx>();
    const def: SagaDefinition<Ctx> = {
      id: 'saga-timeout',
      steps: [
        {
          name: 's1',
          execute: async (ctx) => {
            ctx.log.push('s1');
          },
          compensate: async (ctx) => {
            ctx.log.push('c1');
          },
        },
        {
          name: 'slow',
          timeoutMs: 20,
          execute: () =>
            new Promise<void>((resolve) => {
              setTimeout(resolve, 200);
            }),
        },
      ],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow(/timed out/);
    const state = await saga.getState('saga-timeout');
    expect(state?.status).toBe('compensated');
    expect(state?.context.log).toContain('c1');
  });
});

describe('FR-SAGA.8: 재진입 금지', () => {
  it('store에 running 상태가 있으면 재실행 거부', async () => {
    const store = new MemorySagaStore<Ctx>();
    await store.save({
      sagaId: 'busy',
      status: 'running',
      currentStep: 0,
      completedSteps: [],
      compensatedSteps: [],
      context: newCtx(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
    const saga = new Saga<Ctx>({ store });
    const def: SagaDefinition<Ctx> = {
      id: 'busy',
      steps: [{ name: 's1', execute: async () => {} }],
    };
    await expect(saga.execute(def, newCtx())).rejects.toThrow(
      /already in progress/,
    );
  });
});

describe('FR-SAGA.9: 커스텀 store 주입', () => {
  it('save가 각 전이마다 호출된다', async () => {
    const store = new MemorySagaStore<Ctx>();
    const saveSpy = vi.spyOn(store, 'save');
    const saga = new Saga<Ctx>({ store });
    const def: SagaDefinition<Ctx> = {
      id: 'saga-store',
      steps: [
        { name: 's1', execute: async () => {} },
        { name: 's2', execute: async () => {} },
      ],
    };
    await saga.execute(def, newCtx());
    expect(saveSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    const loaded = await store.load('saga-store');
    expect(loaded?.status).toBe('completed');
  });
});

describe('입력 검증 (CSAP D-12)', () => {
  it('빈 steps 배열은 예외', async () => {
    const saga = new Saga<Ctx>();
    await expect(
      saga.execute({ id: 'empty', steps: [] }, newCtx()),
    ).rejects.toThrow(/at least one step/);
  });

  it('단계 이름 중복은 예외', async () => {
    const saga = new Saga<Ctx>();
    await expect(
      saga.execute(
        {
          id: 'dup',
          steps: [
            { name: 'x', execute: async () => {} },
            { name: 'x', execute: async () => {} },
          ],
        },
        newCtx(),
      ),
    ).rejects.toThrow(/Duplicate/);
  });

  it('id 누락은 예외', async () => {
    const saga = new Saga<Ctx>();
    await expect(
      saga.execute(
        { id: '', steps: [{ name: 's', execute: async () => {} }] },
        newCtx(),
      ),
    ).rejects.toThrow(/id is required/);
  });
});
