/**
 * 변경 실패율 감지기 테스트
 * Design Ref: MTU-N169 §3.3
 * Plan SC: FR-DORA.3
 */

import { ChangeFailureDetector } from '../src/change-failure';

describe('ChangeFailureDetector', () => {
  let detector: ChangeFailureDetector;

  beforeEach(() => {
    detector = new ChangeFailureDetector();
  });

  describe('detect', () => {
    it('롤백 커밋 감지', () => {
      expect(detector.detect([
        { message: 'revert: 이전 배포로 롤백' }
      ])).toBe(true);
    });

    it('핫픽스 커밋 감지', () => {
      expect(detector.detect([
        { message: 'hotfix: 긴급 인증 오류 수정' }
      ])).toBe(true);
    });

    it('일반 커밋은 실패로 감지하지 않음', () => {
      expect(detector.detect([
        { message: 'feat: 새로운 DORA 대시보드 추가' }
      ])).toBe(false);
    });

    it('여러 커밋 중 하나라도 실패 패턴이면 감지', () => {
      expect(detector.detect([
        { message: 'feat: 기능 추가' },
        { message: 'rollback: 긴급 롤백' },
      ])).toBe(true);
    });
  });

  describe('getRate', () => {
    it('실패율 계산 - 10번 중 2번 실패', () => {
      for (let i = 0; i < 8; i++) {
        detector.recordSuccess('team-a', 'auth-service');
      }
      detector.recordFailure('team-a', 'auth-service');
      detector.recordFailure('team-a', 'auth-service');

      const rate = detector.getRate('team-a', 'auth-service');
      expect(rate).toBeCloseTo(0.2, 2);
    });

    it('배포 기록이 없으면 0 반환', () => {
      expect(detector.getRate('unknown', 'unknown')).toBe(0);
    });
  });

  describe('getTeams', () => {
    it('등록된 팀 목록 반환', () => {
      detector.recordSuccess('platform', 'api-gw');
      detector.recordSuccess('backend', 'user-svc');

      const teams = detector.getTeams();
      expect(teams).toContain('platform');
      expect(teams).toContain('backend');
    });
  });
});
