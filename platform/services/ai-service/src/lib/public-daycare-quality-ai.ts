// Design Ref: §공공 어린이집 품질 평가 — 다지표 가중 합산 등급 산정
// Plan SC: FR-R562.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface DaycareMetrics {
  centerId: string;
  name: string;
  teacherRatio: number; // 교사 1인당 아동 수
  hygieneScore: number; // 0~100
  facilitySafety: number; // 0~100
  programRichness: number; // 0~100
  parentSatisfaction: number; // 0~100
  incidentCount: number;
}

export interface DaycareEvaluation {
  centerId: string;
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  improvements: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const WEIGHTS = {
  teacherRatio: 0.25,
  hygiene: 0.2,
  safety: 0.2,
  program: 0.15,
  satisfaction: 0.2,
} as const;

export class PublicDaycareQualityAI {
  private readonly centers = new Map<string, DaycareMetrics>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R562.1
  registerCenter(metrics: DaycareMetrics, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (metrics.teacherRatio <= 0) throw new Error('교사 비율은 0보다 커야 합니다');
    const bounded = [
      metrics.hygieneScore,
      metrics.facilitySafety,
      metrics.programRichness,
      metrics.parentSatisfaction,
    ];
    for (const v of bounded) {
      if (v < 0 || v > 100) throw new Error('점수는 0~100 범위여야 합니다');
    }
    if (metrics.incidentCount < 0) throw new Error('사고 횟수는 0 이상이어야 합니다');
    this.centers.set(metrics.centerId, { ...metrics });
    this.append('REGISTER_CENTER', { centerId: metrics.centerId });
  }

  // Plan SC: FR-R562.2
  private ratioScore(ratio: number): number {
    if (ratio <= 5) return 100;
    if (ratio <= 8) return 85;
    if (ratio <= 12) return 70;
    if (ratio <= 15) return 50;
    return 30;
  }

  // Plan SC: FR-R562.3
  evaluate(centerId: string, grade: DataGrade = 'O'): DaycareEvaluation {
    blockClassifiedData(grade);
    const m = this.centers.get(centerId);
    if (!m) throw new Error(`어린이집 미등록: ${centerId}`);

    const ratioPoints = this.ratioScore(m.teacherRatio);
    const raw =
      ratioPoints * WEIGHTS.teacherRatio +
      m.hygieneScore * WEIGHTS.hygiene +
      m.facilitySafety * WEIGHTS.safety +
      m.programRichness * WEIGHTS.program +
      m.parentSatisfaction * WEIGHTS.satisfaction;

    const penalty = Math.min(20, m.incidentCount * 5);
    const totalScore = Math.max(0, Math.round((raw - penalty) * 100) / 100);

    const letter: DaycareEvaluation['grade'] =
      totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : 'D';

    const improvements: string[] = [];
    if (ratioPoints < 70) improvements.push('교사 대 아동 비율 개선 필요');
    if (m.hygieneScore < 75) improvements.push('위생 관리 체계 점검');
    if (m.facilitySafety < 80) improvements.push('시설 안전 정비 요청');
    if (m.programRichness < 70) improvements.push('교육 프로그램 다양화 권고');
    if (m.parentSatisfaction < 70) improvements.push('학부모 의견 수렴 확대');
    if (m.incidentCount > 0) improvements.push(`사고 이력 ${m.incidentCount}건 재발 방지 대책 수립`);

    const evalResult: DaycareEvaluation = { centerId, totalScore, grade: letter, improvements };
    this.append('EVALUATE', { centerId, grade: letter, totalScore });
    return evalResult;
  }

  // Plan SC: FR-R562.4
  rankByQuality(topN = 5): DaycareEvaluation[] {
    const evals = Array.from(this.centers.keys()).map(id => this.evaluate(id));
    return evals.sort((a, b) => b.totalScore - a.totalScore).slice(0, Math.max(0, topN));
  }

  // Plan SC: FR-R562.5
  listCenters(): DaycareMetrics[] {
    return Array.from(this.centers.values()).map(c => ({ ...c }));
  }

  // Plan SC: FR-R562.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
