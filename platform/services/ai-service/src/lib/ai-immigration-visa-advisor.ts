// Design Ref: §AI 출입국 비자 어드바이저 — 비자 유형 추천 및 자격 검증
// Plan SC: FR-R591.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type VisaType = 'E-1' | 'E-7' | 'D-2' | 'D-8' | 'F-2' | 'F-4' | 'H-2';

export interface ApplicantProfile {
  applicantId: string;
  nationality: string;
  age: number;
  purpose: 'work' | 'study' | 'investment' | 'residence' | 'family';
  educationLevel: 'highschool' | 'bachelor' | 'master' | 'phd';
  koreanLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6; // TOPIK
  annualIncome: number; // KRW
  investmentAmount: number; // KRW
  hasJobOffer: boolean;
  hasKoreanRelative: boolean;
}

export interface VisaRecommendation {
  visaType: VisaType;
  eligible: boolean;
  score: number;
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIImmigrationVisaAdvisor {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  recommend(profile: ApplicantProfile, grade: DataGrade = 'O'): VisaRecommendation[] {
    blockClassifiedData(grade);
    if (profile.age < 17) throw new Error('age는 17세 이상');
    const result: VisaRecommendation[] = [];

    // E-1 교수
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.educationLevel === 'phd') { score += 50; reasons.push('박사'); }
      else if (profile.educationLevel === 'master') { score += 25; reasons.push('석사'); }
      if (profile.hasJobOffer) { score += 30; reasons.push('고용계약'); }
      result.push({ visaType: 'E-1', eligible: score >= 60, score, reasons });
    }

    // E-7 특정활동
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.educationLevel === 'bachelor' || profile.educationLevel === 'master' || profile.educationLevel === 'phd') {
        score += 30; reasons.push('학사 이상');
      }
      if (profile.hasJobOffer) { score += 40; reasons.push('고용계약'); }
      if (profile.annualIncome >= 30_000_000) { score += 20; reasons.push('소득 요건'); }
      result.push({ visaType: 'E-7', eligible: score >= 70, score, reasons });
    }

    // D-2 유학
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.purpose === 'study') { score += 50; reasons.push('유학 목적'); }
      if (profile.koreanLevel >= 3) { score += 30; reasons.push(`TOPIK ${profile.koreanLevel}`); }
      if (profile.educationLevel !== 'highschool') { score += 10; reasons.push('고교 이상'); }
      result.push({ visaType: 'D-2', eligible: score >= 60, score, reasons });
    }

    // D-8 투자
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.investmentAmount >= 100_000_000) { score += 60; reasons.push('1억 이상 투자'); }
      if (profile.purpose === 'investment') { score += 30; reasons.push('투자 목적'); }
      result.push({ visaType: 'D-8', eligible: score >= 60, score, reasons });
    }

    // F-2 거주
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.annualIncome >= 50_000_000) { score += 30; reasons.push('고소득'); }
      if (profile.koreanLevel >= 4) { score += 30; reasons.push(`TOPIK ${profile.koreanLevel}`); }
      if (profile.purpose === 'residence') { score += 20; reasons.push('거주 목적'); }
      result.push({ visaType: 'F-2', eligible: score >= 60, score, reasons });
    }

    // F-4 재외동포
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.hasKoreanRelative) { score += 70; reasons.push('재외동포'); }
      if (profile.age >= 19) { score += 20; reasons.push('성년'); }
      result.push({ visaType: 'F-4', eligible: score >= 70, score, reasons });
    }

    // H-2 방문취업
    {
      const reasons: string[] = [];
      let score = 0;
      if (profile.hasKoreanRelative) { score += 40; reasons.push('재외동포'); }
      if (profile.age >= 25 && profile.age <= 60) { score += 30; reasons.push('연령 적합'); }
      if (profile.purpose === 'work') { score += 20; reasons.push('취업 목적'); }
      result.push({ visaType: 'H-2', eligible: score >= 60, score, reasons });
    }

    result.sort((a, b) => b.score - a.score);
    this.log('RECOMMEND', { applicantId: profile.applicantId, topVisa: result[0]?.visaType });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
