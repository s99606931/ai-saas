// W3C TraceContext + B3 헤더 전파
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.2
// CSAP: D-10 네트워크 보안

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * 추적 컨텍스트 헤더 정의
 *
 * W3C TraceContext (표준) + B3 (Zipkin/Istio 호환) 동시 지원
 */
export interface TraceHeaders {
  /** W3C traceparent (00-{traceId}-{spanId}-{flags}) */
  traceparent?: string;
  /** W3C tracestate (벤더별 추가 정보) */
  tracestate?: string;
  /** B3 단일 헤더 ({traceId}-{spanId}-{sampled}-{parentSpanId}) */
  b3?: string;
  /** B3 다중 헤더: traceId */
  'x-b3-traceid'?: string;
  /** B3 다중 헤더: spanId */
  'x-b3-spanid'?: string;
  /** B3 다중 헤더: parentSpanId */
  'x-b3-parentspanid'?: string;
  /** B3 다중 헤더: sampled */
  'x-b3-sampled'?: string;
  /** 기존 correlationId 연동 */
  'x-request-id'?: string;
}

/** 전파 대상 헤더 목록 */
const PROPAGATION_HEADERS = [
  'traceparent',
  'tracestate',
  'b3',
  'x-b3-traceid',
  'x-b3-spanid',
  'x-b3-parentspanid',
  'x-b3-sampled',
  'x-request-id',
] as const;

/**
 * 16진수 랜덤 문자열 생성
 */
function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  // Node.js crypto 사용
  for (let i = 0; i < bytes; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 추적 컨텍스트 전파 관리자
 *
 * 수신 요청에서 추적 헤더를 추출하고,
 * 발신 요청에 전파할 헤더를 생성합니다.
 */
export class TraceContextPropagator {
  /**
   * 수신 요청에서 추적 헤더 추출
   *
   * 우선순위: W3C traceparent > B3 단일 > B3 다중 > x-request-id
   */
  extractHeaders(request: FastifyRequest): TraceHeaders {
    const headers: TraceHeaders = {};

    for (const name of PROPAGATION_HEADERS) {
      const value = request.headers[name];
      if (typeof value === 'string' && value.length > 0) {
        (headers as Record<string, string>)[name] = value;
      }
    }

    return headers;
  }

  /**
   * 발신 요청용 전파 헤더 생성
   *
   * 수신 헤더가 없으면 새 추적 컨텍스트를 생성합니다.
   */
  createPropagationHeaders(incoming: TraceHeaders): Record<string, string> {
    const outgoing: Record<string, string> = {};

    // W3C traceparent 처리
    if (incoming.traceparent) {
      outgoing['traceparent'] = incoming.traceparent;
      if (incoming.tracestate) {
        outgoing['tracestate'] = incoming.tracestate;
      }
    }

    // B3 헤더 처리
    if (incoming.b3) {
      outgoing['b3'] = incoming.b3;
    }

    if (incoming['x-b3-traceid']) {
      outgoing['x-b3-traceid'] = incoming['x-b3-traceid'];
      if (incoming['x-b3-spanid']) {
        outgoing['x-b3-spanid'] = incoming['x-b3-spanid'];
      }
      if (incoming['x-b3-parentspanid']) {
        outgoing['x-b3-parentspanid'] = incoming['x-b3-parentspanid'];
      }
      if (incoming['x-b3-sampled']) {
        outgoing['x-b3-sampled'] = incoming['x-b3-sampled'];
      }
    }

    // x-request-id (correlationId 연동)
    if (incoming['x-request-id']) {
      outgoing['x-request-id'] = incoming['x-request-id'];
    }

    // 추적 헤더가 하나도 없으면 새로 생성
    if (Object.keys(outgoing).length === 0) {
      return this.generateNewContext();
    }

    // x-request-id만 없으면 추가 생성
    if (!outgoing['x-request-id']) {
      outgoing['x-request-id'] = randomHex(16);
    }

    return outgoing;
  }

  /**
   * 새 추적 컨텍스트 생성
   *
   * W3C + B3 + x-request-id 모두 생성
   */
  generateNewContext(): Record<string, string> {
    const traceId = randomHex(16); // 128-bit
    const spanId = randomHex(8); // 64-bit
    const requestId = randomHex(16);

    return {
      // W3C TraceContext: version-traceId-spanId-flags
      traceparent: `00-${traceId}-${spanId}-01`,
      // B3 단일 헤더: traceId-spanId-sampled
      b3: `${traceId}-${spanId}-1`,
      // B3 다중 헤더
      'x-b3-traceid': traceId,
      'x-b3-spanid': spanId,
      'x-b3-sampled': '1',
      // 기존 correlationId 연동
      'x-request-id': requestId,
    };
  }

  /**
   * Fastify onRequest 훅용 핸들러
   *
   * 요청에서 추적 헤더를 추출하고, 응답에 전파 헤더를 설정합니다.
   */
  onRequestHook(request: FastifyRequest, reply: FastifyReply): void {
    const incoming = this.extractHeaders(request);
    const propagation = this.createPropagationHeaders(incoming);

    // 응답 헤더에 추적 정보 설정 (다운스트림 디버깅용)
    for (const [key, value] of Object.entries(propagation)) {
      reply.header(key, value);
    }

    // 요청 객체에 추적 컨텍스트 저장 (다운스트림 서비스 호출 시 사용)
    (request as unknown as Record<string, unknown>)['traceContext'] = propagation;
  }

  /**
   * W3C traceparent 헤더 파싱
   *
   * 형식: {version}-{traceId}-{spanId}-{flags}
   */
  parseTraceparent(
    traceparent: string,
  ): { version: string; traceId: string; spanId: string; flags: string } | null {
    const parts = traceparent.split('-');
    if (parts.length < 4) return null;

    const [version, traceId, spanId, flags] = parts;
    if (!version || !traceId || !spanId || !flags) return null;

    // 기본 검증
    if (version.length !== 2 || traceId.length !== 32 || spanId.length !== 16 || flags.length !== 2) {
      return null;
    }

    return { version, traceId, spanId, flags };
  }

  /**
   * B3 단일 헤더 파싱
   *
   * 형식: {traceId}-{spanId}-{sampled}[-{parentSpanId}]
   */
  parseB3Single(
    b3: string,
  ): { traceId: string; spanId: string; sampled: string; parentSpanId?: string } | null {
    // 특수 케이스: "0" = deny, "d" = debug
    if (b3 === '0' || b3 === 'd') {
      return null;
    }

    const parts = b3.split('-');
    if (parts.length < 3) return null;

    const [traceId, spanId, sampled, parentSpanId] = parts;
    if (!traceId || !spanId || !sampled) return null;

    return {
      traceId,
      spanId,
      sampled,
      parentSpanId: parentSpanId || undefined,
    };
  }
}
