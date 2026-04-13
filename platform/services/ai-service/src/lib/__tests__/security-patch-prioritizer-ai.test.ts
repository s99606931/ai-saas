import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityPatchPrioritizerAI } from '../security-patch-prioritizer-ai';

describe('SecurityPatchPrioritizerAI', () => {
  let prioritizer: SecurityPatchPrioritizerAI;

  beforeEach(() => {
    prioritizer = new SecurityPatchPrioritizerAI();
  });

  it('패치를 등록한다', () => {
    prioritizer.registerPatch('p1', 'CVE-2026-001', 9.8, 5, 'easy');
    expect(prioritizer.getAuditLog().some(l => l.action === 'REGISTER_PATCH')).toBe(true);
  });

  it('우선순위 점수를 계산한다', () => {
    prioritizer.registerPatch('p1', 'CVE-2026-001', 9.8, 5, 'easy');
    const priority = prioritizer.calculatePriority('p1');
    expect(priority.priorityScore).toBeGreaterThan(0);
    expect(priority.cveId).toBe('CVE-2026-001');
  });

  it('높은 CVSS + 많은 영향 시스템이 높은 우선순위를 가진다', () => {
    prioritizer.registerPatch('p1', 'CVE-HIGH', 9.8, 10, 'easy');
    prioritizer.registerPatch('p2', 'CVE-LOW', 2.0, 1, 'hard');
    const roadmap = prioritizer.getRoadmap();
    expect(roadmap[0]!.patchId).toBe('p1');
  });

  it('우선순위 내림차순 로드맵을 반환한다', () => {
    prioritizer.registerPatch('p1', 'CVE-A', 5.0, 3, 'medium');
    prioritizer.registerPatch('p2', 'CVE-B', 9.0, 8, 'easy');
    const roadmap = prioritizer.getRoadmap();
    expect(roadmap[0]!.priorityScore).toBeGreaterThanOrEqual(roadmap[1]!.priorityScore);
  });

  it('패치 적용을 기록한다', () => {
    prioritizer.registerPatch('p1', 'CVE-2026-001', 9.8, 5, 'easy');
    prioritizer.applyPatch('p1');
    const priority = prioritizer.calculatePriority('p1');
    expect(priority.status).toBe('applied');
  });

  it('C등급 패치 적용을 차단한다', () => {
    prioritizer.registerPatch('p1', 'CVE-2026-001', 9.8, 5, 'easy');
    expect(() => prioritizer.applyPatch('p1', 'C' as never)).toThrow('BLOCKED');
  });

  it('잘못된 CVSS 점수 등록 시 오류를 던진다', () => {
    expect(() => prioritizer.registerPatch('p1', 'CVE-X', 11, 1, 'easy')).toThrow('0~10');
  });
});
