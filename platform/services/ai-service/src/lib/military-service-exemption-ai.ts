// Design Ref: §병역 면제 — 신체·가정·특수사유 기반 면제 자격 AI
// Plan SC: FR-R550.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ExemptionCategory = 'medical' | 'family_support' | 'national_interest' | 'none';

export interface ExemptionApplication {
  applicationId: string;
  medicalGrade: number; // 1~7 (병역판정 기준)
  onlyMaleChildOfDisabledParent: boolean;
  familyDependentCount: number;
  internationalAchievement: boolean;
  prosecuted: boolean;
}

export interface ExemptionResult {
  applicationId: string;
  category: ExemptionCategory;
  eligible: boolean;
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class MilitaryServiceExemptionAI {
  private applications = new Map<string, ExemptionApplication>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R550.1
  submit(app: ExemptionApplication, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (app.medicalGrade < 1 || app.medicalGrade > 7) {
      throw new Error('신체등급은 1~7 범위여야 합니다');
    }
    if (app.familyDependentCount < 0) throw new Error('부양 가족 수는 0 이상이어야 합니다');
    this.applications.set(app.applicationId, { ...app });
    this.append('SUBMIT', { applicationId: app.applicationId });
  }

  // Plan SC: FR-R550.2
  evaluate(applicationId: string, grade: DataGrade = 'O'): ExemptionResult {
    blockClassifiedData(grade);
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`신청서 미등록: ${applicationId}`);
    const reasons: string[] = [];
    let category: ExemptionCategory = 'none';

    if (app.prosecuted) {
      reasons.push('PROSECUTED_DISQUALIFIED');
      this.append('EVALUATE', { applicationId, eligible: false });
      return { applicationId, category: 'none', eligible: false, reasons };
    }

    // 신체등급 5~6: 제2국민역(전시근로역) 또는 면제
    if (app.medicalGrade >= 5 && app.medicalGrade <= 6) {
      category = 'medical';
      reasons.push('MEDICAL_GRADE_5_6');
    }
    // 신체등급 7: 재검사 대상 (면제 아님)
    if (app.medicalGrade === 7) {
      reasons.push('MEDICAL_REEXAMINATION');
    }

    if (app.onlyMaleChildOfDisabledParent) {
      if (category === 'none') category = 'family_support';
      reasons.push('SOLE_SUPPORTER_DISABLED_PARENT');
    }
    if (app.familyDependentCount >= 3) {
      if (category === 'none') category = 'family_support';
      reasons.push('MULTIPLE_DEPENDENTS');
    }
    if (app.internationalAchievement) {
      if (category === 'none') category = 'national_interest';
      reasons.push('INTERNATIONAL_ACHIEVEMENT');
    }

    const eligible = category !== 'none' && app.medicalGrade !== 7;
    const result: ExemptionResult = { applicationId, category, eligible, reasons };
    this.append('EVALUATE', { applicationId, eligible });
    return result;
  }

  // Plan SC: FR-R550.3
  countByCategory(category: ExemptionCategory): number {
    let n = 0;
    for (const [id] of this.applications) {
      if (this.evaluate(id).category === category) n++;
    }
    return n;
  }

  // Plan SC: FR-R550.4
  listEligible(): string[] {
    const ids: string[] = [];
    for (const [id] of this.applications) {
      if (this.evaluate(id).eligible) ids.push(id);
    }
    return ids;
  }

  // Plan SC: FR-R550.5
  get(applicationId: string): ExemptionApplication | undefined {
    const a = this.applications.get(applicationId);
    return a ? { ...a } : undefined;
  }

  // Plan SC: FR-R550.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
