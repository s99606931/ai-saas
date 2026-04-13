// Design Ref: §행정 민원 분류 — 키워드 점수 기반 부서 자동 분류
// Plan SC: FR-R530.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type PetitionUrgency = 'routine' | 'priority' | 'urgent';

export interface DepartmentRule {
  departmentId: string;
  name: string;
  keywords: string[];
  urgencyKeywords: string[];
}

export interface Petition {
  petitionId: string;
  title: string;
  content: string;
  receivedAt: string;
}

export interface ClassificationResult {
  petitionId: string;
  primaryDepartment: string;
  secondaryDepartment: string | null;
  confidence: number;
  urgency: PetitionUrgency;
  matchedKeywords: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function maskPII(text: string): string {
  // 주민등록번호 유사 패턴, 휴대폰, 이메일 마스킹 (CSAP D-12)
  return text
    .replace(/\d{6}[-\s]?\d{7}/g, '[RRN_MASKED]')
    .replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, '[PHONE_MASKED]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL_MASKED]');
}

export class AdminPetitionClassifierAI {
  private departments = new Map<string, DepartmentRule>();
  private petitions = new Map<string, Petition>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R530.1
  registerDepartment(rule: DepartmentRule, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (rule.keywords.length === 0) throw new Error('부서 키워드가 비어 있습니다');
    this.departments.set(rule.departmentId, {
      ...rule,
      keywords: [...rule.keywords],
      urgencyKeywords: [...rule.urgencyKeywords],
    });
    this.append('REGISTER_DEPARTMENT', { departmentId: rule.departmentId });
  }

  // Plan SC: FR-R530.2
  submitPetition(petition: Petition, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (petition.title.trim().length === 0) throw new Error('민원 제목은 비어 있을 수 없습니다');
    const masked: Petition = {
      ...petition,
      title: maskPII(petition.title),
      content: maskPII(petition.content),
    };
    this.petitions.set(petition.petitionId, masked);
    this.append('SUBMIT_PETITION', { petitionId: petition.petitionId });
  }

  // Plan SC: FR-R530.3
  classify(petitionId: string, grade: DataGrade = 'O'): ClassificationResult {
    blockClassifiedData(grade);
    const petition = this.petitions.get(petitionId);
    if (!petition) throw new Error(`민원 미등록: ${petitionId}`);

    const text = `${petition.title} ${petition.content}`.toLowerCase();
    const scores = new Map<string, number>();
    const matchedKeywords: string[] = [];
    let urgencyHits = 0;

    for (const dept of this.departments.values()) {
      let score = 0;
      for (const kw of dept.keywords) {
        if (text.includes(kw.toLowerCase())) {
          score += 10;
          if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
        }
      }
      for (const uk of dept.urgencyKeywords) {
        if (text.includes(uk.toLowerCase())) {
          score += 5;
          urgencyHits += 1;
        }
      }
      if (score > 0) scores.set(dept.departmentId, score);
    }

    const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const primaryEntry = ranked[0];
    const primaryDepartment = primaryEntry ? primaryEntry[0] : 'UNCLASSIFIED';
    const secondaryDepartment = ranked[1] ? ranked[1][0] : null;

    const topScore = primaryEntry ? primaryEntry[1] : 0;
    const totalScore = ranked.reduce((s, e) => s + e[1], 0);
    const confidence = totalScore === 0 ? 0 : Math.round((topScore / totalScore) * 100);

    const urgency: PetitionUrgency = urgencyHits >= 2 ? 'urgent' : urgencyHits === 1 ? 'priority' : 'routine';

    const result: ClassificationResult = {
      petitionId,
      primaryDepartment,
      secondaryDepartment,
      confidence,
      urgency,
      matchedKeywords,
    };
    this.append('CLASSIFY', { petitionId, primaryDepartment, urgency });
    return result;
  }

  // Plan SC: FR-R530.4
  listDepartments(): DepartmentRule[] {
    return Array.from(this.departments.values()).map(d => ({
      ...d,
      keywords: [...d.keywords],
      urgencyKeywords: [...d.urgencyKeywords],
    }));
  }

  // Plan SC: FR-R530.5
  getPetition(petitionId: string): Petition | undefined {
    const p = this.petitions.get(petitionId);
    return p ? { ...p } : undefined;
  }

  // Plan SC: FR-R530.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
