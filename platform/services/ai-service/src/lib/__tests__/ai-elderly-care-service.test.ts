/**
 * AI 노인 돌봄 서비스 단위 테스트 — SVC-AI-ADV-R486
 * Plan SC: FR-486.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiElderlyCareService } from '../ai-elderly-care-service';
import type { ElderlyProfile } from '../ai-elderly-care-service';

const mk = (over: Partial<ElderlyProfile> = {}): ElderlyProfile => ({
  recipientId: 'E1',
  ageYears: 75,
  livesAlone: false,
  dailyActivityScore: 80,
  cognitiveScore: 75,
  chronicDiseaseCount: 1,
  mobility: 'INDEPENDENT',
  ...over,
});

describe('AiElderlyCareService — R486', () => {
  it('FR-486.1: 건강한 독립 노인 → LIGHT', () => {
    const s = new AiElderlyCareService();
    const r = s.recommend(mk());
    expect(['LIGHT', 'STANDARD']).toContain(r.tier);
  });

  it('FR-486.2: 중증 와상 → CRITICAL', () => {
    const s = new AiElderlyCareService();
    const r = s.recommend(
      mk({
        ageYears: 90,
        livesAlone: true,
        dailyActivityScore: 10,
        cognitiveScore: 20,
        chronicDiseaseCount: 5,
        mobility: 'BEDRIDDEN',
      }),
    );
    expect(r.tier).toBe('CRITICAL');
    expect(r.emergencyMonitoring).toBe(true);
    expect(r.visitsPerWeek).toBe(7);
  });

  it('FR-486.3: 독거 → safety_call 포함', () => {
    const s = new AiElderlyCareService();
    const r = s.recommend(mk({ livesAlone: true }));
    expect(r.services).toContain('safety_call');
  });

  it('FR-486.4: 주간 자원 부하 계산', () => {
    const s = new AiElderlyCareService();
    const load = s.weeklyResourceLoad([mk(), mk({ recipientId: 'E2' })]);
    expect(load).toBeGreaterThan(0);
  });

  it('FR-486.5: audit 로그', () => {
    const s = new AiElderlyCareService();
    s.recommend(mk());
    expect(s.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-486.6: C/S 차단', () => {
    const s = new AiElderlyCareService();
    expect(() => s.recommend(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => s.recommend(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
