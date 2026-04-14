import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraphEnricherV3 } from '../knowledge-graph-enricher-v3';

describe('SVC-AI-ADV-R637 KnowledgeGraphEnricherV3', () => {
  let svc: KnowledgeGraphEnricherV3;

  beforeEach(() => {
    svc = new KnowledgeGraphEnricherV3();
  });

  it('FR-R637.1: 엔티티 등록', () => {
    svc.registerEntity('e1', 'person', 'Alice');
    expect(svc.getEnrichmentScore('e1')).toBe(0);
  });

  it('FR-R637.2: C등급 관계 추가 시 BLOCKED', () => {
    svc.registerEntity('e1', 'person', 'Alice');
    svc.registerEntity('e2', 'person', 'Bob');
    expect(() => svc.addRelation('e1', 'e2', 'C')).toThrow(/BLOCKED.*N2SF N-05/);
  });

  it('FR-R637.2: S등급도 BLOCKED', () => {
    svc.registerEntity('e1', 'person', 'Alice');
    svc.registerEntity('e2', 'person', 'Bob');
    expect(() => svc.addRelation('e1', 'e2', 'S')).toThrow(/BLOCKED/);
  });

  it('FR-R637.3: 확장 점수 산출', () => {
    svc.registerEntity('e1', 'org', 'A');
    svc.registerEntity('e2', 'org', 'B');
    svc.registerEntity('e3', 'org', 'C');
    svc.addRelation('e1', 'e2');
    svc.addRelation('e1', 'e3');
    expect(svc.getEnrichmentScore('e1')).toBe(1);
    expect(svc.getEnrichmentScore('e2')).toBeGreaterThan(0);
  });

  it('FR-R637.4: 저연결 엔티티 후보 반환', () => {
    svc.registerEntity('e1', 'org', 'A');
    svc.registerEntity('e2', 'org', 'B');
    svc.registerEntity('e3', 'org', 'C');
    svc.addRelation('e1', 'e2');
    svc.addRelation('e1', 'e3');
    const lows = svc.getLowConnectivityEntities(0.5);
    expect(lows.map((e) => e.id).sort()).toEqual(['e2', 'e3']);
  });

  it('FR-R637.5: 감사 로그 누적', () => {
    svc.registerEntity('e1', 'org', 'A');
    svc.registerEntity('e2', 'org', 'B');
    svc.addRelation('e1', 'e2');
    const log = svc.getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(log.some((e) => e.action === 'ADD_RELATION')).toBe(true);
  });
});
