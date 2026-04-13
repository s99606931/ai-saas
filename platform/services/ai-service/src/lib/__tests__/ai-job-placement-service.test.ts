import { describe, it, expect, beforeEach } from 'vitest';
import { AIJobPlacementService } from '../ai-job-placement-service';

describe('AIJobPlacementService', () => {
  let svc: AIJobPlacementService;

  beforeEach(() => {
    svc = new AIJobPlacementService();
    svc.registerSeeker({ seekerId: 'u1', skills: ['ts', 'react', 'node'], experienceYears: 5, desiredRegion: '서울', desiredSalaryKrw: 60000000 });
    svc.registerPosting({ postingId: 'p1', requiredSkills: ['ts', 'react'], minExperienceYears: 3, region: '서울', salaryKrw: 65000000 });
    svc.registerPosting({ postingId: 'p2', requiredSkills: ['java', 'spring'], minExperienceYears: 5, region: '부산', salaryKrw: 55000000 });
  });

  it('등록한다', () => {
    expect(svc.getAuditLog().filter(e => e.action === 'REGISTER_SEEKER').length).toBe(1);
    expect(svc.getAuditLog().filter(e => e.action === 'REGISTER_POSTING').length).toBe(2);
  });

  it('완벽 매칭 시 100점', () => {
    const result = svc.computeMatch('u1', 'p1');
    expect(result.matchScore).toBe(100);
  });

  it('낮은 매칭은 점수 낮음', () => {
    const result = svc.computeMatch('u1', 'p2');
    expect(result.matchScore).toBeLessThan(50);
  });

  it('구직자에게 공고 추천', () => {
    const recs = svc.recommendForSeeker('u1');
    expect(recs[0]?.postingId).toBe('p1');
  });

  it('공고에 구직자 추천', () => {
    const recs = svc.recommendForPosting('p1');
    expect(recs[0]?.seekerId).toBe('u1');
  });

  it('C등급 데이터 차단', () => {
    expect(() => svc.registerSeeker({ seekerId: 'u2', skills: [], experienceYears: 1, desiredRegion: '서울', desiredSalaryKrw: 30000000 }, 'C')).toThrow('BLOCKED');
  });
});
