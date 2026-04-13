// Design Ref: §공공 식품 안전 점검 AI — HACCP 유사 항목 가중 위반 평가
// Plan SC: FR-R570.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type InspectionCategory =
  | 'hygiene'
  | 'temperature'
  | 'cross-contamination'
  | 'pest-control'
  | 'labeling'
  | 'employee-health';

export interface InspectionFinding {
  category: InspectionCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
}

export interface InspectionReport {
  facilityId: string;
  inspectorRef: string;
  at: string;
  findings: InspectionFinding[];
}

export interface InspectionResult {
  facilityId: string;
  totalDeductions: number;
  score: number; // 0~100
  grade: 'excellent' | 'good' | 'warning' | 'fail' | 'closure';
  criticalIssues: string[];
  mandatoryActions: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const CATEGORY_WEIGHTS: Record<InspectionCategory, number> = {
  hygiene: 4,
  temperature: 5,
  'cross-contamination': 5,
  'pest-control': 4,
  labeling: 2,
  'employee-health': 3,
};

export class PublicFoodSafetyInspectorAI {
  private readonly results = new Map<string, InspectionResult>();
  private readonly reports: InspectionReport[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R570.1
  submitReport(report: InspectionReport, grade: DataGrade = 'O'): InspectionResult {
    blockClassifiedData(grade);
    if (!report.facilityId) throw new Error('시설 ID는 비어있을 수 없습니다');
    if (!report.inspectorRef) throw new Error('점검자 참조는 비어있을 수 없습니다');
    if (!Array.isArray(report.findings)) throw new Error('findings 배열이 필요합니다');
    for (const f of report.findings) {
      if (f.severity < 1 || f.severity > 5) {
        throw new Error('심각도는 1~5 범위여야 합니다');
      }
    }
    this.reports.push({ ...report, findings: [...report.findings] });

    // Plan SC: FR-R570.2 — 가중 차감 계산
    let deductions = 0;
    const criticalIssues: string[] = [];
    for (const f of report.findings) {
      const weight = CATEGORY_WEIGHTS[f.category];
      const points = f.severity * weight;
      deductions += points;
      if (f.severity >= 4) {
        criticalIssues.push(`[${f.category}] ${f.description}`);
      }
    }

    const score = Math.max(0, 100 - deductions);

    // Plan SC: FR-R570.3 — 등급 판정
    let letter: InspectionResult['grade'];
    if (criticalIssues.length >= 3 || score < 40) {
      letter = 'closure';
    } else if (score < 60) {
      letter = 'fail';
    } else if (score < 75) {
      letter = 'warning';
    } else if (score < 90) {
      letter = 'good';
    } else {
      letter = 'excellent';
    }

    // Plan SC: FR-R570.4 — 필수 조치
    const actions: string[] = [];
    if (letter === 'closure') {
      actions.push('즉시 영업 중지 명령');
      actions.push('재점검 통과 후 재개 허용');
    }
    if (letter === 'fail') {
      actions.push('30일 내 개선 조치 필수');
      actions.push('재점검 의무');
    }
    if (letter === 'warning') {
      actions.push('60일 내 개선 완료');
    }
    for (const f of report.findings) {
      if (f.category === 'temperature' && f.severity >= 3) {
        actions.push('냉장/냉동 설비 교체 검토');
      }
      if (f.category === 'pest-control' && f.severity >= 3) {
        actions.push('전문 방역 업체 의뢰');
      }
    }

    const result: InspectionResult = {
      facilityId: report.facilityId,
      totalDeductions: deductions,
      score,
      grade: letter,
      criticalIssues,
      mandatoryActions: Array.from(new Set(actions)),
    };
    this.results.set(report.facilityId, result);
    this.append('INSPECT', { facilityId: report.facilityId, grade: letter, score });
    return result;
  }

  // Plan SC: FR-R570.5
  getResult(facilityId: string): InspectionResult | undefined {
    const r = this.results.get(facilityId);
    return r ? { ...r, criticalIssues: [...r.criticalIssues], mandatoryActions: [...r.mandatoryActions] } : undefined;
  }

  listFailed(): InspectionResult[] {
    return Array.from(this.results.values()).filter(
      r => r.grade === 'fail' || r.grade === 'closure',
    );
  }

  listReports(): InspectionReport[] {
    return this.reports.map(r => ({ ...r, findings: [...r.findings] }));
  }

  // Plan SC: FR-R570.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
