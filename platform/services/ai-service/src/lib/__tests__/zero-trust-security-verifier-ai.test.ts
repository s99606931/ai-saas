import { describe, it, expect, beforeEach } from 'vitest';
import { ZeroTrustSecurityVerifierAI } from '../zero-trust-security-verifier-ai';

describe('ZeroTrustSecurityVerifierAI', () => {
  let verifier: ZeroTrustSecurityVerifierAI;

  beforeEach(() => {
    verifier = new ZeroTrustSecurityVerifierAI();
  });

  it('엔티티를 등록한다', () => {
    verifier.registerEntity('user-1', 'user', 90, 60);
    expect(verifier.getAuditLog().some(l => l.action === 'REGISTER_ENTITY')).toBe(true);
  });

  it('알려진 컨텍스트에서 접근을 허용한다', () => {
    verifier.registerEntity('user-1', 'user', 90, 60);
    const result = verifier.verify('user-1', { location: 'known', device: 'known', timeOfDay: 'business_hours' });
    expect(result.allowed).toBe(true);
    expect(result.trustScore).toBe(90);
  });

  it('알 수 없는 위치에서 신뢰 점수가 감소한다', () => {
    verifier.registerEntity('user-1', 'user', 90, 60);
    const result = verifier.verify('user-1', { location: 'unknown', device: 'known', timeOfDay: 'business_hours' });
    expect(result.trustScore).toBe(70);
    expect(result.allowed).toBe(true);
  });

  it('임계값 미달 시 접근을 거부한다', () => {
    verifier.registerEntity('user-1', 'user', 70, 60);
    const result = verifier.verify('user-1', { location: 'unknown', device: 'unknown', timeOfDay: 'off_hours' });
    expect(result.allowed).toBe(false);
    expect(result.trustScore).toBeLessThan(60);
  });

  it('이상 이벤트를 기록한다', () => {
    verifier.registerEntity('user-1', 'user', 50, 60);
    verifier.verify('user-1', { location: 'unknown', device: 'unknown', timeOfDay: 'off_hours' });
    const anomalies = verifier.getAnomalyEvents('user-1');
    expect(anomalies.length).toBeGreaterThan(0);
  });

  it('신뢰 점수를 조회한다', () => {
    verifier.registerEntity('user-1', 'user', 80, 60);
    verifier.verify('user-1', { location: 'known', device: 'known', timeOfDay: 'off_hours' });
    expect(verifier.getTrustScore('user-1')).toBe(70);
  });

  it('C등급 검증을 차단한다', () => {
    verifier.registerEntity('user-1', 'user', 90, 60);
    expect(() => verifier.verify('user-1', { location: 'known', device: 'known', timeOfDay: 'business_hours' }, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 엔티티 검증 시 오류를 던진다', () => {
    expect(() => verifier.verify('unknown', { location: 'known', device: 'known', timeOfDay: 'business_hours' })).toThrow('엔티티 미등록');
  });
});
