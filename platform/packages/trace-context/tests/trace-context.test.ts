// trace-context 테스트
// Plan SC: FR-TC.1~FR-TC.8

import { describe, it, expect, vi } from 'vitest';
import {
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  buildTraceparent,
} from '../src/trace-id.js';
import {
  sanitizeAttributes,
  DEFAULT_DENY_PATTERNS,
} from '../src/attributes.js';
import {
  runWithContext,
  getCurrentContext,
  getCurrentTraceId,
} from '../src/context.js';
import {
  withSpan,
  setSpanAdapter,
  NoopSpanAdapter,
  type SpanAdapter,
  type SpanHandle,
} from '../src/span.js';

describe('FR-TC.3: ID 생성', () => {
  it('traceId는 32자 소문자 hex', () => {
    const id = generateTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('spanId는 16자 소문자 hex', () => {
    const id = generateSpanId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('생성된 ID는 고유해야 한다', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      ids.add(generateTraceId());
    }
    expect(ids.size).toBe(1000);
  });
});

describe('FR-TC.1: traceparent 파싱', () => {
  it('정상 헤더 파싱', () => {
    const header =
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = parseTraceparent(header);
    expect(parsed).toBeDefined();
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.spanId).toBe('00f067aa0ba902b7');
    expect(parsed?.flags).toBe('01');
  });

  it('부족한 필드 개수 → undefined', () => {
    expect(parseTraceparent('00-abc-def')).toBeUndefined();
  });

  it('잘못된 traceId 길이 → undefined', () => {
    expect(
      parseTraceparent('00-abc-00f067aa0ba902b7-01'),
    ).toBeUndefined();
  });

  it('0으로만 이뤄진 traceId → undefined', () => {
    expect(
      parseTraceparent(
        '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
      ),
    ).toBeUndefined();
  });

  it('0으로만 이뤄진 spanId → undefined', () => {
    expect(
      parseTraceparent(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01',
      ),
    ).toBeUndefined();
  });
});

describe('FR-TC.2: traceparent 빌드', () => {
  it('build 후 parse 재검증', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const header = buildTraceparent(traceId, spanId);
    const parsed = parseTraceparent(header);
    expect(parsed?.traceId).toBe(traceId);
    expect(parsed?.spanId).toBe(spanId);
  });

  it('잘못된 traceId → 예외', () => {
    expect(() => buildTraceparent('short', generateSpanId())).toThrow();
  });
});

describe('FR-TC.6: 속성 검증', () => {
  it('password, token 키는 제거', () => {
    const attrs = sanitizeAttributes({
      userId: 'u-1',
      password: 'secret',
      api_key: 'xxx',
      authorization: 'Bearer abc',
      username: 'alice',
    });
    expect(attrs.userId).toBe('u-1');
    expect(attrs.username).toBe('alice');
    expect(attrs).not.toHaveProperty('password');
    expect(attrs).not.toHaveProperty('api_key');
    expect(attrs).not.toHaveProperty('authorization');
  });

  it('긴 문자열은 잘린다', () => {
    const long = 'a'.repeat(1000);
    const attrs = sanitizeAttributes({ msg: long }, { maxLength: 50 });
    expect((attrs.msg as string).startsWith('a'.repeat(50))).toBe(true);
    expect((attrs.msg as string)).toContain('[truncated]');
  });

  it('객체는 JSON 직렬화', () => {
    const attrs = sanitizeAttributes({ obj: { a: 1 } });
    expect(attrs.obj).toBe('{"a":1}');
  });

  it('DEFAULT_DENY_PATTERNS에 핵심 키 포함', () => {
    expect(DEFAULT_DENY_PATTERNS.length).toBeGreaterThan(5);
  });
});

describe('FR-TC.4, FR-TC.5: withSpan', () => {
  it('정상 실행 → start, end 호출', async () => {
    const calls: string[] = [];
    const adapter: SpanAdapter = {
      start: (name) => {
        calls.push(`start:${name}`);
        return {
          setAttribute: () => undefined,
          recordException: () => calls.push('exception'),
          end: () => calls.push('end'),
        };
      },
    };
    setSpanAdapter(adapter);

    const result = await withSpan('op', async () => 'ok');
    expect(result).toBe('ok');
    expect(calls).toEqual(['start:op', 'end']);

    setSpanAdapter(new NoopSpanAdapter());
  });

  it('에러 발생 → recordException + end + rethrow', async () => {
    const calls: string[] = [];
    const adapter: SpanAdapter = {
      start: () => ({
        setAttribute: () => undefined,
        recordException: () => calls.push('exception'),
        end: () => calls.push('end'),
      }),
    };
    setSpanAdapter(adapter);

    await expect(
      withSpan('bad', async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(calls).toEqual(['exception', 'end']);

    setSpanAdapter(new NoopSpanAdapter());
  });

  it('NoopSpanAdapter 기본 동작 (OTel 미설치 폴백)', async () => {
    setSpanAdapter(new NoopSpanAdapter());
    const result = await withSpan('op', async (span: SpanHandle) => {
      span.setAttribute('k', 'v');
      return 42;
    });
    expect(result).toBe(42);
  });

  it('민감 속성은 어댑터에 전달되지 않는다', async () => {
    const recorded: Record<string, unknown> = {};
    const adapter: SpanAdapter = {
      start: (_name, attrs) => {
        Object.assign(recorded, attrs);
        return {
          setAttribute: () => undefined,
          recordException: () => undefined,
          end: () => undefined,
        };
      },
    };
    setSpanAdapter(adapter);

    await withSpan('op', async () => null, {
      userId: 'u1',
      password: 'p',
    });
    expect(recorded.userId).toBe('u1');
    expect(recorded).not.toHaveProperty('password');

    setSpanAdapter(new NoopSpanAdapter());
  });
});

describe('FR-TC.7, FR-TC.8: 컨텍스트 전파', () => {
  it('runWithContext 내부에서 getCurrentContext 반환', async () => {
    const ctx = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
    };
    await runWithContext(ctx, async () => {
      expect(getCurrentContext()).toEqual(ctx);
      expect(getCurrentTraceId()).toBe(ctx.traceId);
    });
  });

  it('컨텍스트 외부에서 getCurrentContext는 undefined', () => {
    expect(getCurrentContext()).toBeUndefined();
    expect(getCurrentTraceId()).toBeUndefined();
  });

  it('중첩 비동기 흐름에서도 컨텍스트 유지', async () => {
    const ctx = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
    };
    await runWithContext(ctx, async () => {
      await Promise.resolve();
      await new Promise<void>((r) => setTimeout(r, 5));
      expect(getCurrentTraceId()).toBe(ctx.traceId);
    });
  });
});
