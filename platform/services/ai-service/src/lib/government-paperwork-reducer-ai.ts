// Design Ref: §정부 행정 서류 간소화 — 중복 필드 탐지 및 통합 권고
// Plan SC: FR-R604.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface FormDefinition {
  formId: string;
  name: string;
  agency: string;
  fields: string[];
  estimatedMinutes: number;
}

export interface DuplicationReport {
  fieldName: string;
  formIds: string[];
  duplicationRate: number;
}

export interface SimplificationSuggestion {
  formId: string;
  removableFields: string[];
  estimatedSavedMinutes: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovernmentPaperworkReducerAI {
  private forms = new Map<string, FormDefinition>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R604.1
  registerForm(form: FormDefinition, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!form.formId) throw new Error('서류 ID가 필요합니다');
    if (form.fields.length === 0) throw new Error('필드가 최소 1개 이상 있어야 합니다');
    if (form.estimatedMinutes < 0) throw new Error('소요 시간은 0 이상이어야 합니다');
    this.forms.set(form.formId, { ...form, fields: [...form.fields] });
    this.append('REGISTER_FORM', { formId: form.formId, agency: form.agency });
  }

  // Plan SC: FR-R604.2
  detectDuplicates(minForms = 2): DuplicationReport[] {
    const fieldMap = new Map<string, Set<string>>();
    for (const form of this.forms.values()) {
      for (const field of form.fields) {
        if (!fieldMap.has(field)) fieldMap.set(field, new Set());
        fieldMap.get(field)!.add(form.formId);
      }
    }
    const total = this.forms.size;
    const reports: DuplicationReport[] = [];
    for (const [fieldName, formIds] of fieldMap.entries()) {
      if (formIds.size >= minForms) {
        reports.push({
          fieldName,
          formIds: Array.from(formIds),
          duplicationRate: total === 0 ? 0 : Math.round((formIds.size / total) * 10000) / 100,
        });
      }
    }
    reports.sort((a, b) => b.duplicationRate - a.duplicationRate);
    return reports;
  }

  // Plan SC: FR-R604.3
  suggestSimplification(formId: string, grade: DataGrade = 'O'): SimplificationSuggestion {
    blockClassifiedData(grade);
    const form = this.forms.get(formId);
    if (!form) throw new Error(`서류 미등록: ${formId}`);

    const duplicates = this.detectDuplicates();
    const duplicateFieldNames = new Set(duplicates.map(d => d.fieldName));
    const removable = form.fields.filter(f => duplicateFieldNames.has(f));

    const reductionRatio = form.fields.length === 0 ? 0 : removable.length / form.fields.length;
    const estimatedSavedMinutes = Math.round(form.estimatedMinutes * reductionRatio * 100) / 100;

    this.append('SUGGEST_SIMPLIFICATION', { formId, removableCount: removable.length });
    return { formId, removableFields: removable, estimatedSavedMinutes };
  }

  // Plan SC: FR-R604.4
  totalEstimatedMinutes(agency?: string): number {
    let total = 0;
    for (const form of this.forms.values()) {
      if (agency && form.agency !== agency) continue;
      total += form.estimatedMinutes;
    }
    return total;
  }

  // Plan SC: FR-R604.5
  listForms(agency?: string): FormDefinition[] {
    return Array.from(this.forms.values())
      .filter(f => !agency || f.agency === agency)
      .map(f => ({ ...f, fields: [...f.fields] }));
  }

  // Plan SC: FR-R604.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
