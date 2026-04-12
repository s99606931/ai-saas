// MTU-N385 gRPC 스트리밍 AI 테스트
import { describe, it, expect } from 'vitest';
import { GrpcStreamingAiService } from '../grpc-streaming-ai.js';

describe('MTU-N385 GrpcStreamingAi', () => {
  const svc = new GrpcStreamingAiService('tenant-n385');

  it('FR-N385.1: 세션 생성 및 토큰 푸시', () => {
    const sess = svc.create(10);
    const frame = svc.push(sess.sessionId, 'hello');
    expect(frame.index).toBe(1);
    expect(frame.token).toBe('hello');
  });

  it('FR-N385.2: 백프레셔 (버퍼 가득)', () => {
    const sess = svc.create(2);
    svc.push(sess.sessionId, 't1');
    svc.push(sess.sessionId, 't2');
    expect(() => svc.push(sess.sessionId, 't3')).toThrow();
  });

  it('FR-N385.3: 소비 후 재개', () => {
    const sess = svc.create(2);
    svc.push(sess.sessionId, 't1');
    svc.push(sess.sessionId, 't2');
    svc.consume(sess.sessionId);
    svc.consume(sess.sessionId);
    svc.reconnect(sess.sessionId);
    const f = svc.push(sess.sessionId, 't3');
    expect(f.token).toBe('t3');
  });

  it('FR-N385.4: 세션 종료 + 감사 로그', () => {
    const sess = svc.create();
    svc.close(sess.sessionId);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
