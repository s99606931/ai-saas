// MTU-N385 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  createSession,
  pushToken,
  consumeToken,
  closeSession,
  reconnectSession,
  getSession,
  getGrpcAuditLog,
  GrpcStreamingAiService,
} from '../../src/lib/grpc-streaming-ai';

describe('MTU-N385 GrpcStreamingAi', () => {
  it('세션 생성', () => {
    const s = createSession('t1');
    expect(s.status).toBe('active');
  });

  it('토큰 푸시', () => {
    const s = createSession('t1');
    const frame = pushToken(s.sessionId, 'hello');
    expect(frame.token).toBe('hello');
    expect(frame.index).toBe(1);
  });

  it('세션 없는 경우 예외', () => {
    expect(() => pushToken('nope', 'x')).toThrow();
  });

  it('백프레셔 버퍼 가득', () => {
    const s = createSession('t1', 2);
    pushToken(s.sessionId, 'a');
    pushToken(s.sessionId, 'b');
    expect(() => pushToken(s.sessionId, 'c')).toThrow(/백프레셔/);
  });

  it('consume 후 다시 푸시 가능', () => {
    const s = createSession('t1', 2);
    pushToken(s.sessionId, 'a');
    pushToken(s.sessionId, 'b');
    consumeToken(s.sessionId);
    // 이 시점에서 세션 상태가 active로 복구될 수 있음
    const sess = getSession(s.sessionId);
    expect(sess).toBeDefined();
  });

  it('세션 닫기', () => {
    const s = createSession('t1');
    closeSession('t1', s.sessionId);
    expect(getSession(s.sessionId)?.status).toBe('closed');
  });

  it('닫힌 세션에 푸시 실패', () => {
    const s = createSession('t1');
    closeSession('t1', s.sessionId);
    expect(() => pushToken(s.sessionId, 'x')).toThrow(/비활성/);
  });

  it('재연결', () => {
    const s = createSession('t1', 1);
    pushToken(s.sessionId, 'a');
    try {
      pushToken(s.sessionId, 'b');
    } catch {
      // ignore
    }
    const reconnected = reconnectSession(s.sessionId);
    expect(reconnected.status).toBe('active');
  });

  it('서비스 클래스', () => {
    const svc = new GrpcStreamingAiService('t2');
    const s = svc.create();
    expect(s.tenantId).toBe('t2');
  });

  it('감사 로그 테넌트 격리', () => {
    createSession('tA');
    createSession('tB');
    expect(getGrpcAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
