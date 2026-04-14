import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentPlaybookGeneratorV2 } from '../incident-playbook-generator-v2';

describe('SVC-AI-ADV-R645 IncidentPlaybookGeneratorV2', () => {
  let svc: IncidentPlaybookGeneratorV2;

  beforeEach(() => {
    svc = new IncidentPlaybookGeneratorV2();
  });

  it('FR-R645.1: 장애 유형 등록', () => {
    svc.registerIncident('db-down', 'critical');
    expect(svc.getStepCount('db-down')).toBe(0);
  });

  it('FR-R645.2: C등급 차단', () => {
    svc.registerIncident('db-down', 'critical');
    expect(() => svc.addStep('db-down', 'restart', 'C')).toThrow(/BLOCKED/);
  });

  it('FR-R645.3: 단계 수 누적', () => {
    svc.registerIncident('db-down', 'critical');
    svc.addStep('db-down', '백업 확인');
    svc.addStep('db-down', '재시작');
    svc.addStep('db-down', '모니터링');
    expect(svc.getStepCount('db-down')).toBe(3);
  });

  it('FR-R645.4: 단계 부족 유형 탐지', () => {
    svc.registerIncident('db-down', 'critical');
    svc.registerIncident('net-flap', 'medium');
    svc.addStep('db-down', 's1');
    svc.addStep('db-down', 's2');
    svc.addStep('db-down', 's3');
    svc.addStep('net-flap', 's1');
    const insufficient = svc.getInsufficientPlaybooks(3);
    expect(insufficient.map((i) => i.incidentType)).toEqual(['net-flap']);
  });

  it('FR-R645.5: 감사 로그 기록', () => {
    svc.registerIncident('db-down', 'critical');
    svc.addStep('db-down', 's1');
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'ADD_STEP')).toBe(true);
  });
});
