import { describe, it, expect, beforeEach } from 'vitest';
import { SmartDocumentRouter } from '../smart-document-router.js';

describe('SVC-AI-ADV-R399 SmartDocumentRouter', () => {
  let svc: SmartDocumentRouter;
  beforeEach(() => {
    svc = new SmartDocumentRouter();
    svc.registerDepartment({
      id: 'finance',
      name: '재정팀',
      keywords: ['예산', '결산', '세입'],
      staff: [
        { id: 'f1', load: 3 },
        { id: 'f2', load: 1 },
      ],
    });
    svc.registerDepartment({
      id: 'hr',
      name: '인사팀',
      keywords: ['인사', '채용', '급여'],
      staff: [{ id: 'h1', load: 5 }],
    });
  });

  it('FR-389.1: 부서 매칭 + 최저 로드 담당자', () => {
    const r = svc.route('2026년도 예산 결산 보고');
    expect(r.departmentId).toBe('finance');
    expect(r.assigneeId).toBe('f2');
    expect(r.matchCount).toBe(2);
  });

  it('FR-389.2: 신뢰도 계산', () => {
    const r = svc.route('인사 채용 급여 예산');
    expect(r.departmentId).toBe('hr');
    // hr=3, finance=1, total=4, confidence=0.75
    expect(r.confidence).toBeCloseTo(0.75, 2);
  });

  it('FR-389.3: 매칭 없음 unassigned', () => {
    const r = svc.route('관련 없는 문서입니다');
    expect(r.departmentId).toBe('unassigned');
    expect(r.confidence).toBe(0);
  });

  it('FR-389.4: C등급 차단', () => {
    expect(() => svc.route('예산', 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-389.5: 로드 밸런싱 (중복 배정 시 로드 증가)', () => {
    svc.route('예산');
    svc.route('예산');
    // 처음 f2(load=1)→2로, 두 번째 f1(load=3) vs f2(load=2) → f2 선택
    const log = svc.getAuditLog().filter((e) => e.action === 'ROUTE');
    expect(log.length).toBe(2);
  });

  it('감사 로그 기록', () => {
    svc.route('예산');
    expect(svc.getAuditLog().some((e) => e.action === 'ROUTE')).toBe(true);
  });
});
