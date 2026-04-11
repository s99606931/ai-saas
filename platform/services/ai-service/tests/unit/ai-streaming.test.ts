// SVC-AI-ADV-R6 단위 테스트: AI SSE 스트리밍 코어
// Design Ref: SVC-AI-ADV-R6 DESIGN §1, §3, §4, §6
// Plan SC: FR-ADV6.1, FR-ADV6.2, FR-ADV6.4, FR-ADV6.5, FR-ADV6.6, FR-ADV6.7
// CSAP: D-12, D-06

import { describe, it, expect } from 'vitest';
import {
  encodeSSEEvent,
  getSSEHeaders,
} from '../../src/lib/ai-streaming.js';
import type {
  SSEEvent,
  SSETokenEvent,
  SSEUsageEvent,
  SSEDoneEvent,
  SSEErrorEvent,
} from '../../src/lib/ai-streaming.js';

describe('SSE 이벤트 인코딩 (FR-ADV6.1)', () => {
  const decoder = new TextDecoder();

  it('토큰 이벤트를 SSE 형식으로 인코딩한다', () => {
    const event: SSEEvent = {
      type: 'token',
      data: { delta: '안녕', index: 0 },
    };
    const encoded = encodeSSEEvent(event);
    const text = decoder.decode(encoded);
    expect(text).toContain('event: token');
    expect(text).toContain('"delta":"안녕"');
    expect(text).toContain('"index":0');
    expect(text.endsWith('\n\n')).toBe(true);
  });

  it('사용량 이벤트를 SSE 형식으로 인코딩한다', () => {
    const event: SSEEvent = {
      type: 'usage',
      data: { promptTokens: 50, completionTokens: 120, totalTokens: 170 },
    };
    const encoded = encodeSSEEvent(event);
    const text = decoder.decode(encoded);
    expect(text).toContain('event: usage');
    expect(text).toContain('"promptTokens":50');
    expect(text).toContain('"completionTokens":120');
    expect(text).toContain('"totalTokens":170');
  });

  it('완료 이벤트를 SSE 형식으로 인코딩한다', () => {
    const event: SSEEvent = {
      type: 'done',
      data: { finishReason: 'stop', totalTokens: 170 },
    };
    const encoded = encodeSSEEvent(event);
    const text = decoder.decode(encoded);
    expect(text).toContain('event: done');
    expect(text).toContain('"finishReason":"stop"');
  });

  it('에러 이벤트를 SSE 형식으로 인코딩한다', () => {
    const event: SSEEvent = {
      type: 'error',
      data: { code: 'PROVIDER_ERROR', message: 'LLM 오류' },
    };
    const encoded = encodeSSEEvent(event);
    const text = decoder.decode(encoded);
    expect(text).toContain('event: error');
    expect(text).toContain('"code":"PROVIDER_ERROR"');
  });

  it('핑 이벤트를 SSE 형식으로 인코딩한다', () => {
    const event: SSEEvent = {
      type: 'ping',
      data: {},
    };
    const encoded = encodeSSEEvent(event);
    const text = decoder.decode(encoded);
    expect(text).toContain('event: ping');
    expect(text).toContain('data: {}');
  });

  it('SSE 프로토콜 형식(event: type\\ndata: json\\n\\n)을 따른다', () => {
    const event: SSEEvent = {
      type: 'token',
      data: { delta: 'test', index: 0 },
    };
    const text = decoder.decode(encodeSSEEvent(event));
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^event: token$/);
    expect(lines[1]).toMatch(/^data: \{.*\}$/);
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('');
  });

  it('인코딩 결과는 Uint8Array이다', () => {
    const event: SSEEvent = { type: 'ping', data: {} };
    const encoded = encodeSSEEvent(event);
    expect(encoded).toBeInstanceOf(Uint8Array);
  });

  it('취소 완료 이벤트를 인코딩한다', () => {
    const event: SSEEvent = {
      type: 'done',
      data: { finishReason: 'cancelled', totalTokens: 50 },
    };
    const text = decoder.decode(encodeSSEEvent(event));
    expect(text).toContain('"finishReason":"cancelled"');
  });

  it('에러 코드 타입이 올바르다', () => {
    const errorCodes = ['PROVIDER_ERROR', 'TOKEN_LIMIT', 'TIMEOUT', 'INTERNAL_ERROR', 'BUFFER_OVERFLOW'] as const;
    for (const code of errorCodes) {
      const event: SSEEvent = {
        type: 'error',
        data: { code, message: '테스트' } as SSEErrorEvent,
      };
      const text = decoder.decode(encodeSSEEvent(event));
      expect(text).toContain(`"code":"${code}"`);
    }
  });
});

describe('SSE 응답 헤더', () => {
  it('올바른 Content-Type을 반환한다', () => {
    const headers = getSSEHeaders();
    expect(headers['Content-Type']).toBe('text/event-stream');
  });

  it('Cache-Control을 no-cache로 설정한다', () => {
    const headers = getSSEHeaders();
    expect(headers['Cache-Control']).toContain('no-cache');
  });

  it('Connection을 keep-alive로 설정한다', () => {
    const headers = getSSEHeaders();
    expect(headers['Connection']).toBe('keep-alive');
  });

  it('nginx 프록시 버퍼링을 비활성화한다', () => {
    const headers = getSSEHeaders();
    expect(headers['X-Accel-Buffering']).toBe('no');
  });

  it('CORS 헤더를 포함한다', () => {
    const headers = getSSEHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

describe('SSE 이벤트 타입 안전성', () => {
  it('SSETokenEvent 구조가 올바르다', () => {
    const event: SSETokenEvent = { delta: '테스트', index: 5 };
    expect(event.delta).toBe('테스트');
    expect(event.index).toBe(5);
  });

  it('SSEUsageEvent 구조가 올바르다', () => {
    const event: SSEUsageEvent = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    };
    expect(event.totalTokens).toBe(300);
  });

  it('SSEDoneEvent finishReason 타입이 올바르다', () => {
    const reasons: Array<SSEDoneEvent['finishReason']> = ['stop', 'length', 'cancelled'];
    for (const reason of reasons) {
      const event: SSEDoneEvent = { finishReason: reason, totalTokens: 100 };
      expect(event.finishReason).toBe(reason);
    }
  });
});
