// Design Ref: §보조금 사기 탐지 AI
// Plan SC: FR-R624.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type FraudFlag =
  | 'duplicate_applicant'
  | 'suspicious_address'
  | 'overclaimed_amount'
  | 'income_mismatch'
  | 'ghost_beneficiary'
  | 'rapid_resubmission';

type RiskBand = 'low' | 'medium' | 'high' | 'critical';

interface GrantApplication {
  applicationId: string;
  applicantHash: string; // PII는 해시 처리
  amountKrw: number;
  programCode: string;
  submittedAt: string;
  incomeReported: number;
  addressHash: string;
}

interface FraudAssessment {
  applicationId: string;
  riskScore: number; // 0~100
  riskBand: RiskBand;
  flags: FraudFlag[];
  recommendedAction: 'approve' | 'review' | 'investigate' | 'reject';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const PROGRAM_LIMIT: Record<string, number> = {
  housing: 50_000_000,
  education: 10_000_000,
  startup: 100_000_000,
  welfare: 5_000_000,
};

export class GrantFraudDetectionAI {
  private applications: GrantApplication[] = [];
  private assessments = new Map<string, FraudAssessment>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R624.1
  registerApplication(app: GrantApplication, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (app.amountKrw <= 0) throw new Error('금액 > 0 필요');
    this.applications.push(app);
    this.log('REGISTER_APPLICATION', { id: app.applicationId });
  }

  // Plan SC: FR-R624.2
  private detectFlags(app: GrantApplication): FraudFlag[] {
    const flags: FraudFlag[] = [];
    // 동일 신청자 반복
    const sameApplicant = this.applications.filter((a) => a.applicantHash === app.applicantHash);
    if (sameApplicant.length >= 3) flags.push('duplicate_applicant');

    // 같은 주소에 다수 신청자
    const sameAddress = new Set(
      this.applications.filter((a) => a.addressHash === app.addressHash).map((a) => a.applicantHash),
    );
    if (sameAddress.size >= 4) flags.push('suspicious_address');

    // 프로그램 한도 초과
    const limit = PROGRAM_LIMIT[app.programCode];
    if (limit && app.amountKrw > limit) flags.push('overclaimed_amount');

    // 소득 대비 부적합
    if (app.incomeReported > 0 && app.amountKrw > app.incomeReported * 2) {
      flags.push('income_mismatch');
    }

    // 고스트 수혜자 - 금액 0이거나 소득 0
    if (app.incomeReported === 0 && app.amountKrw > 1_000_000) flags.push('ghost_beneficiary');

    // 빠른 재제출
    const byApplicant = sameApplicant.slice().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    if (byApplicant.length >= 2) {
      const last = byApplicant[byApplicant.length - 1]!;
      const prev = byApplicant[byApplicant.length - 2]!;
      const diffMs = new Date(last.submittedAt).getTime() - new Date(prev.submittedAt).getTime();
      if (diffMs >= 0 && diffMs < 24 * 3600 * 1000) flags.push('rapid_resubmission');
    }

    return flags;
  }

  // Plan SC: FR-R624.3
  private computeScore(flags: FraudFlag[]): number {
    const weight: Record<FraudFlag, number> = {
      duplicate_applicant: 25,
      suspicious_address: 20,
      overclaimed_amount: 30,
      income_mismatch: 18,
      ghost_beneficiary: 35,
      rapid_resubmission: 12,
    };
    const total = flags.reduce((s, f) => s + weight[f], 0);
    return Math.min(100, total);
  }

  private bandFromScore(score: number): RiskBand {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  // Plan SC: FR-R624.4
  assess(applicationId: string, grade: DataGrade = DataGrade.O): FraudAssessment {
    blockClassifiedData(grade);
    const app = this.applications.find((a) => a.applicationId === applicationId);
    if (!app) throw new Error(`신청 미등록: ${applicationId}`);
    const flags = this.detectFlags(app);
    const score = this.computeScore(flags);
    const band = this.bandFromScore(score);
    const action: FraudAssessment['recommendedAction'] =
      band === 'critical' ? 'reject'
      : band === 'high' ? 'investigate'
      : band === 'medium' ? 'review'
      : 'approve';

    const assessment: FraudAssessment = {
      applicationId,
      riskScore: score,
      riskBand: band,
      flags,
      recommendedAction: action,
    };
    this.assessments.set(applicationId, assessment);
    this.log('ASSESS', { id: applicationId, score, band });
    return assessment;
  }

  // Plan SC: FR-R624.5
  getAssessment(applicationId: string): FraudAssessment | undefined {
    return this.assessments.get(applicationId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
