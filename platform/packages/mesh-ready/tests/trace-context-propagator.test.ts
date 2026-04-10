// TraceContextPropagator 단위 테스트
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.2

import { describe, it, expect, beforeEach } from 'vitest';
import { TraceContextPropagator } from '../src/trace-context-propagator.js';

describe('TraceContextPropagator', () => {
  let propagator: TraceContextPropagator;

  beforeEach(() => {
    propagator = new TraceContextPropagator();
  });

  describe('extractHeaders', () => {
    it('W3C traceparent 헤더를 추출한다', () => {
      const request = {
        headers: {
          traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        },
      } as any;

      const result = propagator.extractHeaders(request);

      expect(result.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    });

    it('B3 단일 헤더를 추출한다', () => {
      const request = {
        headers: {
          b3: '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1',
        },
      } as any;

      const result = propagator.extractHeaders(request);

      expect(result.b3).toBe('80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1');
    });

    it('B3 다중 헤더를 추출한다', () => {
      const request = {
        headers: {
          'x-b3-traceid': '80f198ee56343ba864fe8b2a57d3eff7',
          'x-b3-spanid': 'e457b5a2e4d86bd1',
          'x-b3-parentspanid': '05e3ac9a4f6e3b90',
          'x-b3-sampled': '1',
        },
      } as any;

      const result = propagator.extractHeaders(request);

      expect(result['x-b3-traceid']).toBe('80f198ee56343ba864fe8b2a57d3eff7');
      expect(result['x-b3-spanid']).toBe('e457b5a2e4d86bd1');
      expect(result['x-b3-parentspanid']).toBe('05e3ac9a4f6e3b90');
      expect(result['x-b3-sampled']).toBe('1');
    });

    it('x-request-id를 추출한다', () => {
      const request = {
        headers: {
          'x-request-id': 'req-12345-abcdef',
        },
      } as any;

      const result = propagator.extractHeaders(request);

      expect(result['x-request-id']).toBe('req-12345-abcdef');
    });

    it('빈 헤더에서 빈 객체를 반환한다', () => {
      const request = { headers: {} } as any;

      const result = propagator.extractHeaders(request);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('createPropagationHeaders', () => {
    it('W3C traceparent를 전파한다', () => {
      const incoming = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        tracestate: 'vendor=opaque',
      };

      const result = propagator.createPropagationHeaders(incoming);

      expect(result['traceparent']).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
      expect(result['tracestate']).toBe('vendor=opaque');
      expect(result['x-request-id']).toBeDefined();
    });

    it('B3 헤더를 전파한다', () => {
      const incoming = {
        'x-b3-traceid': '80f198ee56343ba864fe8b2a57d3eff7',
        'x-b3-spanid': 'e457b5a2e4d86bd1',
        'x-b3-sampled': '1',
      };

      const result = propagator.createPropagationHeaders(incoming);

      expect(result['x-b3-traceid']).toBe('80f198ee56343ba864fe8b2a57d3eff7');
      expect(result['x-b3-spanid']).toBe('e457b5a2e4d86bd1');
      expect(result['x-b3-sampled']).toBe('1');
    });

    it('헤더가 없으면 새 컨텍스트를 생성한다', () => {
      const result = propagator.createPropagationHeaders({});

      expect(result['traceparent']).toBeDefined();
      expect(result['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
      expect(result['b3']).toBeDefined();
      expect(result['x-b3-traceid']).toBeDefined();
      expect(result['x-b3-spanid']).toBeDefined();
      expect(result['x-b3-sampled']).toBe('1');
      expect(result['x-request-id']).toBeDefined();
    });
  });

  describe('generateNewContext', () => {
    it('W3C + B3 + x-request-id 모두 생성한다', () => {
      const result = propagator.generateNewContext();

      expect(result['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
      expect(result['b3']).toMatch(/^[0-9a-f]{32}-[0-9a-f]{16}-1$/);
      expect(result['x-b3-traceid']).toMatch(/^[0-9a-f]{32}$/);
      expect(result['x-b3-spanid']).toMatch(/^[0-9a-f]{16}$/);
      expect(result['x-b3-sampled']).toBe('1');
      expect(result['x-request-id']).toMatch(/^[0-9a-f]{32}$/);
    });

    it('traceparent와 B3의 traceId/spanId가 일치한다', () => {
      const result = propagator.generateNewContext();

      const tpParts = result['traceparent']!.split('-');
      const b3Parts = result['b3']!.split('-');

      // traceparent의 traceId === B3의 traceId
      expect(tpParts[1]).toBe(b3Parts[0]);
      expect(tpParts[1]).toBe(result['x-b3-traceid']);

      // traceparent의 spanId === B3의 spanId
      expect(tpParts[2]).toBe(b3Parts[1]);
      expect(tpParts[2]).toBe(result['x-b3-spanid']);
    });
  });

  describe('parseTraceparent', () => {
    it('유효한 traceparent를 파싱한다', () => {
      const result = propagator.parseTraceparent(
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      );

      expect(result).not.toBeNull();
      expect(result!.version).toBe('00');
      expect(result!.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(result!.spanId).toBe('b7ad6b7169203331');
      expect(result!.flags).toBe('01');
    });

    it('잘못된 형식에 null을 반환한다', () => {
      expect(propagator.parseTraceparent('invalid')).toBeNull();
      expect(propagator.parseTraceparent('00-short-id-01')).toBeNull();
      expect(propagator.parseTraceparent('')).toBeNull();
    });
  });

  describe('parseB3Single', () => {
    it('유효한 B3 단일 헤더를 파싱한다', () => {
      const result = propagator.parseB3Single(
        '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1',
      );

      expect(result).not.toBeNull();
      expect(result!.traceId).toBe('80f198ee56343ba864fe8b2a57d3eff7');
      expect(result!.spanId).toBe('e457b5a2e4d86bd1');
      expect(result!.sampled).toBe('1');
    });

    it('parentSpanId가 있으면 포함한다', () => {
      const result = propagator.parseB3Single(
        '80f198ee56343ba864fe8b2a57d3eff7-e457b5a2e4d86bd1-1-05e3ac9a4f6e3b90',
      );

      expect(result!.parentSpanId).toBe('05e3ac9a4f6e3b90');
    });

    it('deny/debug 플래그에 null을 반환한다', () => {
      expect(propagator.parseB3Single('0')).toBeNull();
      expect(propagator.parseB3Single('d')).toBeNull();
    });
  });
});
