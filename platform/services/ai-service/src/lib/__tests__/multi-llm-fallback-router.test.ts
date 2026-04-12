import { describe, it, expect } from 'vitest';
import {
  MultiLLMFallbackRouter,
  type ProviderSpec,
  type CallResult,
} from '../multi-llm-fallback-router.js';

function spec(
  id: string,
  envKey: string,
  priority: number,
  cost = 0.01,
  latency = 100,
): ProviderSpec {
  return {
    id,
    envKey,
    priority,
    costPer1kTokens: cost,
    avgLatencyMs: latency,
    enabled: true,
  };
}

function ok(id: string, tokens = 500, latency = 100): CallResult {
  return { providerId: id, ok: true, tokens, latencyMs: latency };
}

function fail(id: string, msg = 'timeout'): CallResult {
  return { providerId: id, ok: false, tokens: 0, latencyMs: 50, error: msg };
}

describe('registerProvider (FR-R79.1, D-09)', () => {
  it('정상 등록', () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('openai', 'LLM_OPENAI_API_KEY', 1));
    expect(r.circuitOf('openai')).toBe('closed');
    expect(r.getAuditLog().some((e) => e.action === 'REGISTER')).toBe(true);
  });

  it('envKey 형식 검증', () => {
    const r = new MultiLLMFallbackRouter();
    expect(() =>
      r.registerProvider({
        id: 'bad',
        envKey: 'lowercase',
        priority: 1,
        costPer1kTokens: 0.01,
        avgLatencyMs: 100,
        enabled: true,
      }),
    ).toThrow('PROVIDER_ENVKEY_INVALID');
  });

  it('시크릿 하드코딩 탐지 (sk-...)', () => {
    const r = new MultiLLMFallbackRouter();
    expect(() =>
      r.registerProvider({
        id: 'sk-abcdef0123456789abcdef',
        envKey: 'LLM_X_KEY',
        priority: 1,
        costPer1kTokens: 0,
        avgLatencyMs: 100,
        enabled: true,
      }),
    ).toThrow('SECRET_HARDCODED');
  });

  it('priority 최소값', () => {
    const r = new MultiLLMFallbackRouter();
    expect(() =>
      r.registerProvider(spec('x', 'LLM_X_KEY', 0)),
    ).toThrow('PROVIDER_PRIORITY_INVALID');
  });
});

describe('resolveKey (D-09)', () => {
  it('env에서 값 조회만', () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('openai', 'LLM_TEST_KEY_123', 1));
    process.env.LLM_TEST_KEY_123 = 'secret-val';
    expect(r.resolveKey('openai')).toBe('secret-val');
    delete process.env.LLM_TEST_KEY_123;
    expect(r.resolveKey('openai')).toBeUndefined();
  });
});

describe('decide (FR-R79.2)', () => {
  it('priority 정책', () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 3));
    r.registerProvider(spec('b', 'LLM_B_KEY', 1));
    r.registerProvider(spec('c', 'LLM_C_KEY', 2));
    const d = r.decide('priority');
    expect(d.chain).toEqual(['b', 'c', 'a']);
  });

  it('cost 정책', () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1, 0.05));
    r.registerProvider(spec('b', 'LLM_B_KEY', 2, 0.01));
    const d = r.decide('cost');
    expect(d.chain[0]).toBe('b');
  });

  it('latency 정책', () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('slow', 'LLM_SLOW_KEY', 1, 0.01, 500));
    r.registerProvider(spec('fast', 'LLM_FAST_KEY', 2, 0.01, 50));
    const d = r.decide('latency');
    expect(d.chain[0]).toBe('fast');
  });
});

describe('execute + fallback (FR-R79.3)', () => {
  it('첫 프로바이더 성공', async () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1));
    r.registerProvider(spec('b', 'LLM_B_KEY', 2));
    const res = await r.execute('priority', async (id) => ok(id));
    expect(res.providerId).toBe('a');
    expect(res.ok).toBe(true);
  });

  it('첫 실패 → 두 번째 폴백 성공', async () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1));
    r.registerProvider(spec('b', 'LLM_B_KEY', 2));
    const res = await r.execute('priority', async (id) =>
      id === 'a' ? fail(id) : ok(id),
    );
    expect(res.providerId).toBe('b');
    expect(res.ok).toBe(true);
  });

  it('연속 실패 → 서킷 open', async () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1));
    r.registerProvider(spec('b', 'LLM_B_KEY', 2));
    for (let i = 0; i < 3; i += 1) {
      await r.execute('priority', async (id) =>
        id === 'a' ? fail(id) : ok(id),
      );
    }
    expect(r.circuitOf('a')).toBe('open');
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'CIRCUIT_OPEN')).toBe(true);
  });

  it('모든 프로바이더 실패', async () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1));
    r.registerProvider(spec('b', 'LLM_B_KEY', 2));
    const res = await r.execute('priority', async (id) => fail(id));
    expect(res.ok).toBe(false);
    expect(res.providerId).toBe('none');
  });

  it('쿨다운 후 half-open → 성공 시 closed', async () => {
    const r = new MultiLLMFallbackRouter({
      failureThreshold: 2,
      cooldownMs: 100,
    });
    let now = 1_000_000;
    r.setClock(() => now);
    r.registerProvider(spec('a', 'LLM_A_KEY', 1));
    r.registerProvider(spec('b', 'LLM_B_KEY', 2));
    // 2회 실패 → open
    await r.execute('priority', async (id) =>
      id === 'a' ? fail(id) : ok(id),
    );
    await r.execute('priority', async (id) =>
      id === 'a' ? fail(id) : ok(id),
    );
    expect(r.circuitOf('a')).toBe('open');
    // 쿨다운 경과
    now += 200;
    // 다시 호출 → half-open → 성공
    await r.execute('priority', async (id) => ok(id));
    expect(r.circuitOf('a')).toBe('closed');
  });
});

describe('aggregate (FR-R79.4)', () => {
  it('호출 집계', async () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1, 0.02));
    await r.execute('priority', async (id) => ok(id, 1000, 200));
    await r.execute('priority', async (id) => ok(id, 500, 100));
    const agg = r.aggregate();
    const row = agg.find((a) => a.providerId === 'a');
    expect(row?.calls).toBe(2);
    expect(row?.successes).toBe(2);
    expect(row?.costTotal).toBeCloseTo(0.02 * 1 + 0.02 * 0.5, 4);
    expect(row?.avgLatencyMs).toBeCloseTo(150, 1);
  });
});

describe('audit (FR-R79.5, D-06)', () => {
  it('ROUTE/CALL_OK 이벤트 기록', async () => {
    const r = new MultiLLMFallbackRouter();
    r.registerProvider(spec('a', 'LLM_A_KEY', 1));
    await r.execute('priority', async (id) => ok(id));
    const log = r.getAuditLog();
    expect(log.some((e) => e.action === 'ROUTE')).toBe(true);
    expect(log.some((e) => e.action === 'CALL_OK')).toBe(true);
  });
});
