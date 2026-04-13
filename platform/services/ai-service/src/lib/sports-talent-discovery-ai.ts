// Design Ref: §체육 인재 발굴 AI — 종목 적합도 프로파일링
// Plan SC: FR-R580.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type Sport = 'soccer' | 'basketball' | 'swimming' | 'athletics' | 'gymnastics' | 'taekwondo';

export interface PhysicalProfile {
  athleteCode: string;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  verticalJumpCm: number;
  sprint50mSec: number;
  enduranceRunKm: number;
  flexibilityCm: number;
}

export interface SportFit {
  sport: Sport;
  fitScore: number;
  strengths: string[];
  development: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class SportsTalentDiscoveryAI {
  private profiles = new Map<string, PhysicalProfile>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R580.1
  registerProfile(profile: PhysicalProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (profile.ageYears < 6 || profile.ageYears > 25) {
      throw new Error('인재 발굴 대상 연령은 6~25세입니다');
    }
    if (profile.heightCm <= 0 || profile.weightKg <= 0) {
      throw new Error('신장/체중은 0보다 커야 합니다');
    }
    this.profiles.set(profile.athleteCode, { ...profile });
    this.append('REGISTER_PROFILE', { athleteCode: profile.athleteCode });
  }

  // Plan SC: FR-R580.2
  analyzeFit(athleteCode: string, grade: DataGrade = 'O'): SportFit[] {
    blockClassifiedData(grade);
    const p = this.profiles.get(athleteCode);
    if (!p) throw new Error(`프로필 미등록: ${athleteCode}`);

    const results: SportFit[] = [];

    // 축구 — 지구력/스프린트
    {
      const strengths: string[] = [];
      const development: string[] = [];
      let score = 0;
      if (p.enduranceRunKm >= 2.5) {
        score += 35;
        strengths.push('지구력');
      } else development.push('지구력 향상');
      if (p.sprint50mSec <= 7.5) {
        score += 30;
        strengths.push('스프린트');
      } else development.push('스프린트 훈련');
      if (p.flexibilityCm >= 15) score += 10;
      results.push({ sport: 'soccer', fitScore: score, strengths, development });
    }

    // 농구 — 신장/점프
    {
      const strengths: string[] = [];
      const development: string[] = [];
      let score = 0;
      if (p.heightCm >= 180) {
        score += 35;
        strengths.push('신장');
      } else development.push('종합 체력');
      if (p.verticalJumpCm >= 55) {
        score += 35;
        strengths.push('점프력');
      } else development.push('점프 훈련');
      if (p.sprint50mSec <= 7.8) score += 10;
      results.push({ sport: 'basketball', fitScore: score, strengths, development });
    }

    // 수영 — 신장/유연성
    {
      const strengths: string[] = [];
      const development: string[] = [];
      let score = 0;
      if (p.heightCm >= 170) {
        score += 25;
        strengths.push('신장');
      }
      if (p.flexibilityCm >= 20) {
        score += 30;
        strengths.push('유연성');
      } else development.push('유연성 훈련');
      if (p.enduranceRunKm >= 2.0) score += 20;
      results.push({ sport: 'swimming', fitScore: score, strengths, development });
    }

    // 육상 — 스프린트/지구력
    {
      const strengths: string[] = [];
      const development: string[] = [];
      let score = 0;
      if (p.sprint50mSec <= 7.0) {
        score += 40;
        strengths.push('최고 스프린트');
      } else development.push('스프린트 훈련');
      if (p.enduranceRunKm >= 3.0) {
        score += 30;
        strengths.push('최고 지구력');
      }
      results.push({ sport: 'athletics', fitScore: score, strengths, development });
    }

    // 체조 — 유연성/BMI
    {
      const strengths: string[] = [];
      const development: string[] = [];
      let score = 0;
      const bmi = p.weightKg / Math.pow(p.heightCm / 100, 2);
      if (bmi >= 18 && bmi <= 22) {
        score += 25;
        strengths.push('이상 BMI');
      }
      if (p.flexibilityCm >= 25) {
        score += 40;
        strengths.push('최고 유연성');
      } else development.push('유연성 훈련');
      if (p.verticalJumpCm >= 45) score += 15;
      results.push({ sport: 'gymnastics', fitScore: score, strengths, development });
    }

    // 태권도 — 유연성/파워
    {
      const strengths: string[] = [];
      const development: string[] = [];
      let score = 0;
      if (p.flexibilityCm >= 20) {
        score += 30;
        strengths.push('유연성');
      }
      if (p.verticalJumpCm >= 50) {
        score += 30;
        strengths.push('파워');
      }
      if (p.sprint50mSec <= 7.8) score += 15;
      results.push({ sport: 'taekwondo', fitScore: score, strengths, development });
    }

    results.sort((a, b) => b.fitScore - a.fitScore);
    this.append('ANALYZE_FIT', { athleteCode });
    return results;
  }

  // Plan SC: FR-R580.3
  getTopRecommendation(athleteCode: string): SportFit {
    const fits = this.analyzeFit(athleteCode);
    if (fits.length === 0 || !fits[0]) throw new Error('분석 결과 없음');
    return fits[0];
  }

  // Plan SC: FR-R580.4
  listTalentPool(sport: Sport, minScore = 60): string[] {
    const codes: { code: string; score: number }[] = [];
    for (const code of this.profiles.keys()) {
      const fit = this.analyzeFit(code).find(f => f.sport === sport);
      if (fit && fit.fitScore >= minScore) {
        codes.push({ code, score: fit.fitScore });
      }
    }
    codes.sort((a, b) => b.score - a.score);
    return codes.map(c => c.code);
  }

  // Plan SC: FR-R580.5
  getProfileCount(): number {
    return this.profiles.size;
  }

  // Plan SC: FR-R580.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
