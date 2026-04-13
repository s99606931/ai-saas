// Design Ref: §공공 예술 지원 평가 — 다기준 지원금 배분 모델
// Plan SC: FR-R556.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ArtGenre = 'music' | 'visual' | 'theater' | 'dance' | 'literature' | 'film';

export interface GrantApplication {
  applicationId: string;
  genre: ArtGenre;
  requestedAmountKRW: number;
  artisticMeritScore: number; // 0~100
  publicAccessScore: number; // 0~100
  feasibilityScore: number; // 0~100
  localImpactScore: number; // 0~100
  previousGrantCount: number;
}

export interface EvaluationResult {
  applicationId: string;
  totalScore: number;
  awardedAmountKRW: number;
  decision: 'full' | 'partial' | 'reject';
  rationale: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicArtFundingEvaluator {
  private applications = new Map<string, GrantApplication>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R556.1
  submit(app: GrantApplication, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    const scores = [app.artisticMeritScore, app.publicAccessScore, app.feasibilityScore, app.localImpactScore];
    for (const s of scores) {
      if (s < 0 || s > 100) throw new Error('각 점수는 0~100 범위여야 합니다');
    }
    if (app.requestedAmountKRW <= 0) throw new Error('신청 금액은 0보다 커야 합니다');
    if (app.previousGrantCount < 0) throw new Error('이전 수혜 횟수는 0 이상이어야 합니다');
    this.applications.set(app.applicationId, { ...app });
    this.append('SUBMIT', { applicationId: app.applicationId, genre: app.genre });
  }

  // Plan SC: FR-R556.2
  evaluate(applicationId: string, grade: DataGrade = 'O'): EvaluationResult {
    blockClassifiedData(grade);
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`신청 미등록: ${applicationId}`);

    // weighted total
    const weighted =
      app.artisticMeritScore * 0.35 +
      app.publicAccessScore * 0.25 +
      app.feasibilityScore * 0.25 +
      app.localImpactScore * 0.15;

    // diversity penalty for repeat winners
    const diversityPenalty = Math.min(app.previousGrantCount * 3, 15);
    const totalScore = Math.round((weighted - diversityPenalty) * 100) / 100;

    const rationale: string[] = [];
    rationale.push(`가중 점수: ${weighted.toFixed(2)}`);
    if (diversityPenalty > 0) rationale.push(`다양성 감점: -${diversityPenalty}`);

    let decision: EvaluationResult['decision'];
    let awardedAmountKRW: number;
    if (totalScore >= 75) {
      decision = 'full';
      awardedAmountKRW = app.requestedAmountKRW;
      rationale.push('우수 평가 — 전액 지원');
    } else if (totalScore >= 55) {
      decision = 'partial';
      const ratio = totalScore / 100;
      awardedAmountKRW = Math.round(app.requestedAmountKRW * ratio);
      rationale.push(`부분 지원 — 점수 비례 (${Math.round(ratio * 100)}%)`);
    } else {
      decision = 'reject';
      awardedAmountKRW = 0;
      rationale.push('최저 기준 미달');
    }

    const result: EvaluationResult = { applicationId, totalScore, awardedAmountKRW, decision, rationale };
    this.append('EVALUATE', { applicationId, decision, totalScore });
    return result;
  }

  // Plan SC: FR-R556.3
  rankTop(n: number, genre?: ArtGenre): EvaluationResult[] {
    const apps = Array.from(this.applications.values()).filter(a => !genre || a.genre === genre);
    const results = apps.map(a => this.evaluate(a.applicationId));
    return results.sort((a, b) => b.totalScore - a.totalScore).slice(0, Math.max(0, n));
  }

  // Plan SC: FR-R556.4
  allocateBudget(totalBudgetKRW: number, grade: DataGrade = 'O'): EvaluationResult[] {
    blockClassifiedData(grade);
    if (totalBudgetKRW <= 0) throw new Error('총 예산은 0보다 커야 합니다');
    const ordered = Array.from(this.applications.values())
      .map(a => this.evaluate(a.applicationId))
      .sort((a, b) => b.totalScore - a.totalScore);

    const allocations: EvaluationResult[] = [];
    let remaining = totalBudgetKRW;
    for (const r of ordered) {
      if (r.decision === 'reject') {
        allocations.push(r);
        continue;
      }
      const grant = Math.min(r.awardedAmountKRW, remaining);
      remaining -= grant;
      allocations.push({ ...r, awardedAmountKRW: grant, rationale: [...r.rationale, `배분액: ${grant}`] });
      if (remaining <= 0) break;
    }
    this.append('ALLOCATE_BUDGET', { totalBudgetKRW, allocated: totalBudgetKRW - remaining });
    return allocations;
  }

  // Plan SC: FR-R556.5
  listApplications(genre?: ArtGenre): GrantApplication[] {
    const all = Array.from(this.applications.values());
    return (genre ? all.filter(a => a.genre === genre) : all).map(a => ({ ...a }));
  }

  // Plan SC: FR-R556.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
