// SVC-AI-ADV-R436 Environmental Complaint Classifier AI
// Design Ref: SVC-AI-ADV-R436.design.md
// Plan SC: FR-436.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type ComplaintType = 'NOISE' | 'AIR' | 'WATER' | 'WASTE' | 'OTHER';
export type Urgency = 'HIGH' | 'NORMAL';

export interface Complaint {
  readonly id: string;
  readonly text: string;
  readonly region: string;
}

export interface Classified {
  readonly id: string;
  readonly type: ComplaintType;
  readonly urgency: Urgency;
  readonly agency: string;
  readonly confidence: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const KEYWORDS: Record<Exclude<ComplaintType, 'OTHER'>, readonly string[]> = {
  NOISE: ['소음', '진동', '공사'],
  AIR: ['매연', '먼지', '악취', '대기'],
  WATER: ['오폐수', '수질', '하천'],
  WASTE: ['쓰레기', '폐기물', '투기'],
};

const URGENT_KEYWORDS = ['유해', '긴급', '중독'] as const;

const REGION_AGENCY: Record<string, string> = {
  서울: '수도권지방환경청',
  경기: '수도권지방환경청',
  인천: '수도권지방환경청',
  대전: '중부지방환경청',
  충청: '중부지방환경청',
  부산: '남부지방환경청',
  경남: '남부지방환경청',
};

export class EnvironmentalComplaintClassifierAI {
  private readonly auditLog: AuditEntry[] = [];

  classify(complaints: readonly Complaint[], grade: DataGrade = 'O'): readonly Classified[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 민원 데이터 차단 (N2SF N-05)`);
    }

    const results: Classified[] = complaints.map((c) => {
      let bestType: ComplaintType = 'OTHER';
      let bestHits = 0;
      for (const [type, kws] of Object.entries(KEYWORDS) as Array<
        [Exclude<ComplaintType, 'OTHER'>, readonly string[]]
      >) {
        const hits = kws.filter((k) => c.text.includes(k)).length;
        if (hits > bestHits) {
          bestHits = hits;
          bestType = type;
        }
      }
      const urgency: Urgency = URGENT_KEYWORDS.some((k) => c.text.includes(k))
        ? 'HIGH'
        : 'NORMAL';

      let agency = '기타지방환경청';
      for (const [prefix, ag] of Object.entries(REGION_AGENCY)) {
        if (c.region.startsWith(prefix)) {
          agency = ag;
          break;
        }
      }

      const confidence = bestType === 'OTHER' ? 0 : Math.min(1, bestHits / 2);
      return {
        id: c.id,
        type: bestType,
        urgency,
        agency,
        confidence: Number(confidence.toFixed(4)),
      };
    });

    this.record('CLASSIFY', 'batch', { count: results.length });
    return results;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
