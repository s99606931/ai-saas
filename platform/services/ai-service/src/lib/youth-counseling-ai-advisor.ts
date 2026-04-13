// Design Ref: §청소년 상담 AI 어드바이저 — 위기 단계 트리아지
// Plan SC: FR-R576.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type Topic = 'school' | 'family' | 'bullying' | 'mental_health' | 'career' | 'relationship';

export interface CounselingSession {
  sessionId: string;
  counseleeCode: string; // 익명 코드 (실명 금지)
  ageGroup: '10-13' | '14-16' | '17-19';
  topics: Topic[];
  suicidalIdeation: boolean;
  selfHarmHistory: boolean;
  supportNetwork: 'strong' | 'moderate' | 'weak' | 'none';
  createdAt: string;
}

export interface TriageResult {
  sessionId: string;
  riskLevel: RiskLevel;
  riskScore: number;
  recommendedActions: string[];
  referralRequired: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const CONTAINS_PII_REGEX = /[가-힣]{3,}/; // 한글 이름 추정

export class YouthCounselingAIAdvisor {
  private sessions = new Map<string, CounselingSession>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R576.1
  createSession(session: CounselingSession, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (CONTAINS_PII_REGEX.test(session.counseleeCode)) {
      throw new Error('익명 코드는 실명을 포함할 수 없습니다');
    }
    this.sessions.set(session.sessionId, { ...session, topics: [...session.topics] });
    this.append('CREATE_SESSION', { sessionId: session.sessionId });
  }

  // Plan SC: FR-R576.2
  triage(sessionId: string, grade: DataGrade = 'O'): TriageResult {
    blockClassifiedData(grade);
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`세션 미등록: ${sessionId}`);

    let score = 0;
    const actions: string[] = [];

    if (s.suicidalIdeation) {
      score += 60;
      actions.push('자살예방상담전화 1393 즉시 연결');
    }
    if (s.selfHarmHistory) {
      score += 30;
      actions.push('정신건강 전문의 면담 권고');
    }
    if (s.topics.includes('bullying')) {
      score += 20;
      actions.push('학교폭력 신고센터 연계');
    }
    if (s.topics.includes('mental_health')) {
      score += 15;
      actions.push('정신건강복지센터 연계');
    }
    if (s.supportNetwork === 'none') {
      score += 20;
      actions.push('사회적 안전망 구축 지원');
    } else if (s.supportNetwork === 'weak') {
      score += 10;
    }
    if (s.topics.includes('family')) {
      score += 8;
      actions.push('가족상담 센터 정보 제공');
    }
    if (s.topics.includes('career')) {
      score += 3;
      actions.push('진로상담 프로그램 안내');
    }

    let riskLevel: RiskLevel;
    if (score >= 70 || s.suicidalIdeation) riskLevel = 'critical';
    else if (score >= 45) riskLevel = 'high';
    else if (score >= 20) riskLevel = 'moderate';
    else riskLevel = 'low';

    const referralRequired = riskLevel === 'critical' || riskLevel === 'high';

    this.append('TRIAGE', { sessionId, riskLevel, score });
    return {
      sessionId,
      riskLevel,
      riskScore: score,
      recommendedActions: actions,
      referralRequired,
    };
  }

  // Plan SC: FR-R576.3
  listCriticalSessions(): TriageResult[] {
    const results: TriageResult[] = [];
    for (const id of this.sessions.keys()) {
      const r = this.triage(id);
      if (r.riskLevel === 'critical') results.push(r);
    }
    return results;
  }

  // Plan SC: FR-R576.4
  getSessionsByTopic(topic: Topic): CounselingSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.topics.includes(topic))
      .map(s => ({ ...s, topics: [...s.topics] }));
  }

  // Plan SC: FR-R576.5
  getSessionCount(): number {
    return this.sessions.size;
  }

  // Plan SC: FR-R576.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
