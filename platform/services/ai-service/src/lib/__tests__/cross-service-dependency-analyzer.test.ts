import { describe, it, expect, beforeEach } from 'vitest';
import { CrossServiceDependencyAnalyzer } from '../cross-service-dependency-analyzer';

describe('CrossServiceDependencyAnalyzer', () => {
  let analyzer: CrossServiceDependencyAnalyzer;

  beforeEach(() => {
    analyzer = new CrossServiceDependencyAnalyzer();
  });

  it('서비스를 등록하고 감사 로그를 기록한다', () => {
    analyzer.registerService('svc-a', 'Service A');
    const logs = analyzer.getAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0]!.action).toBe('REGISTER_SERVICE');
  });

  it('의존성을 추가한다', () => {
    analyzer.registerService('svc-a', 'A');
    analyzer.registerService('svc-b', 'B');
    analyzer.addDependency('svc-a', 'svc-b', 'sync');
    const logs = analyzer.getAuditLog();
    expect(logs.some(l => l.action === 'ADD_DEPENDENCY')).toBe(true);
  });

  it('미등록 서비스 의존성 추가 시 오류를 던진다', () => {
    analyzer.registerService('svc-a', 'A');
    expect(() => analyzer.addDependency('svc-a', 'svc-z', 'sync')).toThrow('서비스 미등록');
  });

  it('사이클 A→B→C→A를 탐지한다', () => {
    analyzer.registerService('svc-a', 'A');
    analyzer.registerService('svc-b', 'B');
    analyzer.registerService('svc-c', 'C');
    analyzer.addDependency('svc-a', 'svc-b');
    analyzer.addDependency('svc-b', 'svc-c');
    analyzer.addDependency('svc-c', 'svc-a');
    const cycles = analyzer.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]!.severity).toBe('high');
  });

  it('사이클이 없으면 빈 배열을 반환한다', () => {
    analyzer.registerService('svc-a', 'A');
    analyzer.registerService('svc-b', 'B');
    analyzer.addDependency('svc-a', 'svc-b');
    const cycles = analyzer.detectCycles();
    expect(cycles.length).toBe(0);
  });

  it('영향받는 서비스를 BFS로 반환한다', () => {
    analyzer.registerService('svc-a', 'A');
    analyzer.registerService('svc-b', 'B');
    analyzer.registerService('svc-c', 'C');
    analyzer.addDependency('svc-b', 'svc-a');
    analyzer.addDependency('svc-c', 'svc-a');
    const impacted = analyzer.getImpactedServices('svc-a');
    expect(impacted.map(i => i.serviceId)).toContain('svc-b');
    expect(impacted.map(i => i.serviceId)).toContain('svc-c');
  });

  it('C등급 데이터 전송을 차단한다', () => {
    analyzer.registerService('svc-a', 'A');
    expect(() => analyzer.getImpactedServices('svc-a', 'C' as never)).toThrow('BLOCKED');
  });

  it('SPOF를 탐지한다 (in-degree >= 3)', () => {
    analyzer.registerService('db', 'DB');
    for (let i = 1; i <= 4; i++) {
      analyzer.registerService(`svc-${i}`, `Svc ${i}`);
      analyzer.addDependency(`svc-${i}`, 'db');
    }
    const spof = analyzer.getSPOF();
    expect(spof).toContain('db');
  });

  it('감사 로그는 원본 참조를 반환하지 않는다', () => {
    analyzer.registerService('svc-a', 'A');
    const logs1 = analyzer.getAuditLog();
    analyzer.registerService('svc-b', 'B');
    const logs2 = analyzer.getAuditLog();
    expect(logs1.length).toBe(1);
    expect(logs2.length).toBe(2);
  });
});
