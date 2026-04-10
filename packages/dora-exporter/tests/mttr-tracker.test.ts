/**
 * MTTR 추적기 테스트
 * Design Ref: MTU-N169 §3.4
 * Plan SC: FR-DORA.4
 */

import { MTTRTracker } from '../src/mttr-tracker';

describe('MTTRTracker', () => {
  let tracker: MTTRTracker;

  beforeEach(() => {
    tracker = new MTTRTracker();
  });

  describe('recordIncidentStart / recordIncidentEnd', () => {
    it('장애 시작과 종료 기록, MTTR 계산', () => {
      const start = '2026-04-10T10:00:00Z';
      const end = '2026-04-10T10:30:00Z';

      tracker.recordIncidentStart('auth-service', 'platform', start);
      const mttr = tracker.recordIncidentEnd('auth-service', 'platform', end);

      expect(mttr).toBe(1800); // 30분 = 1800초
    });

    it('활성 장애 없이 종료 호출 시 null 반환', () => {
      const result = tracker.recordIncidentEnd('unknown', 'team', '2026-04-10T10:00:00Z');
      expect(result).toBeNull();
    });

    it('중복 장애 시작은 무시', () => {
      tracker.recordIncidentStart('auth-service', 'platform', '2026-04-10T10:00:00Z');
      tracker.recordIncidentStart('auth-service', 'platform', '2026-04-10T10:05:00Z');

      const mttr = tracker.recordIncidentEnd('auth-service', 'platform', '2026-04-10T10:30:00Z');
      expect(mttr).toBe(1800); // 첫 번째 시작 시간 기준
    });
  });

  describe('getMedianMTTR', () => {
    it('중앙값 MTTR 계산', () => {
      // 3건의 장애: 600초, 1200초, 1800초
      tracker.recordIncidentStart('svc-a', 'team-a', '2026-04-10T10:00:00Z');
      tracker.recordIncidentEnd('svc-a', 'team-a', '2026-04-10T10:10:00Z'); // 600초

      tracker.recordIncidentStart('svc-b', 'team-a', '2026-04-10T11:00:00Z');
      tracker.recordIncidentEnd('svc-b', 'team-a', '2026-04-10T11:20:00Z'); // 1200초

      tracker.recordIncidentStart('svc-c', 'team-a', '2026-04-10T12:00:00Z');
      tracker.recordIncidentEnd('svc-c', 'team-a', '2026-04-10T12:30:00Z'); // 1800초

      const median = tracker.getMedianMTTR('team-a');
      expect(median).toBe(1200); // 중앙값
    });

    it('기록이 없으면 0 반환', () => {
      expect(tracker.getMedianMTTR('unknown')).toBe(0);
    });
  });

  describe('통계', () => {
    it('활성 장애 및 해결된 장애 수 추적', () => {
      tracker.recordIncidentStart('svc-a', 'team-a', '2026-04-10T10:00:00Z');
      expect(tracker.getActiveIncidentCount()).toBe(1);
      expect(tracker.getResolvedCount()).toBe(0);

      tracker.recordIncidentEnd('svc-a', 'team-a', '2026-04-10T10:30:00Z');
      expect(tracker.getActiveIncidentCount()).toBe(0);
      expect(tracker.getResolvedCount()).toBe(1);
    });
  });
});
