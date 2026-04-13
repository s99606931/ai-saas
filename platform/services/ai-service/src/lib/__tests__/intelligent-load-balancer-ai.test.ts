import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligentLoadBalancerAI } from '../intelligent-load-balancer-ai';

describe('IntelligentLoadBalancerAI', () => {
  let balancer: IntelligentLoadBalancerAI;

  beforeEach(() => {
    balancer = new IntelligentLoadBalancerAI();
  });

  it('서버를 등록한다', () => {
    balancer.registerServer('s1', 'Server 1', 100, 1000);
    expect(balancer.getAuditLog().some(l => l.action === 'REGISTER_SERVER')).toBe(true);
  });

  it('서버 상태를 업데이트한다', () => {
    balancer.registerServer('s1', 'Server 1', 100, 1000);
    balancer.updateServerStatus('s1', 50, 100, true);
    expect(balancer.getAuditLog().some(l => l.action === 'UPDATE_SERVER_STATUS')).toBe(true);
  });

  it('effectiveWeight 최대 서버로 라우팅한다', () => {
    balancer.registerServer('s1', 'Server 1', 100, 1000);
    balancer.registerServer('s2', 'Server 2', 200, 1000);
    balancer.updateServerStatus('s1', 50, 0, true);
    balancer.updateServerStatus('s2', 50, 0, true);
    const decision = balancer.route();
    expect(decision.selectedServerId).toBe('s2');
  });

  it('비건강 서버를 라우팅에서 제외한다', () => {
    balancer.registerServer('s1', 'Server 1', 100, 1000);
    balancer.registerServer('s2', 'Server 2', 50, 1000);
    balancer.updateServerStatus('s1', 50, 0, false);
    balancer.updateServerStatus('s2', 50, 0, true);
    const decision = balancer.route();
    expect(decision.selectedServerId).toBe('s2');
  });

  it('연결 비율에 따라 effectiveWeight가 감소한다', () => {
    balancer.registerServer('s1', 'Server 1', 100, 100);
    balancer.updateServerStatus('s1', 50, 50, true);
    const statuses = balancer.getServerStatuses();
    expect(statuses[0]!.effectiveWeight).toBe(50);
  });

  it('C등급 데이터 라우팅을 차단한다', () => {
    balancer.registerServer('s1', 'Server 1');
    expect(() => balancer.route('C' as never)).toThrow('BLOCKED');
  });

  it('가중치 자동 조정을 수행한다', () => {
    balancer.registerServer('s1', 'Server 1', 100, 1000);
    balancer.registerServer('s2', 'Server 2', 100, 1000);
    balancer.updateServerStatus('s1', 10, 0, true);
    balancer.updateServerStatus('s2', 200, 0, true);
    balancer.adjustWeights();
    expect(balancer.getAuditLog().some(l => l.action === 'ADJUST_WEIGHTS')).toBe(true);
  });

  it('건강한 서버 없으면 오류를 던진다', () => {
    balancer.registerServer('s1', 'Server 1');
    balancer.updateServerStatus('s1', 0, 0, false);
    expect(() => balancer.route()).toThrow('사용 가능한 건강한 서버 없음');
  });
});
