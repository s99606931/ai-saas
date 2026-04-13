// Design Ref: §AI 챗봇 라우터 (멀티 에이전트 분류)
// Plan SC: FR-R628.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type AgentKind =
  | 'welfare'
  | 'tax'
  | 'civil_complaint'
  | 'housing'
  | 'traffic'
  | 'general_info'
  | 'emergency';

interface Intent {
  kind: AgentKind;
  confidence: number;
  matchedKeywords: string[];
}

interface RouteDecision {
  requestId: string;
  primaryAgent: AgentKind;
  fallbackAgents: AgentKind[];
  intent: Intent;
  sanitizedQuery: string;
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

const AGENT_KEYWORDS: Record<AgentKind, string[]> = {
  welfare: ['복지', '지원금', '수급', '기초생활', '보조금', '노인', '장애'],
  tax: ['세금', '세무', '환급', '납세', '세액', '종합소득', '부가세'],
  civil_complaint: ['민원', '신고', '불편', '요청', '접수', '건의'],
  housing: ['주택', '임대', '청약', '전세', '분양', '아파트'],
  traffic: ['교통', '과태료', '주차', '버스', '지하철', '운전'],
  general_info: ['안내', '정보', '시간', '위치', '전화', '홈페이지'],
  emergency: ['긴급', '응급', '사고', '화재', '지진', '위험'],
};

// 간단한 PII 마스킹
function maskPII(text: string): string {
  return text
    .replace(/\b\d{6}-\d{7}\b/g, '[주민번호]')
    .replace(/\b01[0-9]-?\d{3,4}-?\d{4}\b/g, '[전화번호]')
    .replace(/\b\d{3,4}-\d{3,4}-\d{4}\b/g, '[전화번호]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[이메일]');
}

export class AIChatbotRouter {
  private routes: RouteDecision[] = [];
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R628.1
  sanitize(query: string, grade: DataGrade = DataGrade.O): string {
    blockClassifiedData(grade);
    if (!query.trim()) throw new Error('빈 쿼리');
    return maskPII(query);
  }

  // Plan SC: FR-R628.2
  classify(query: string): Intent {
    const scores = new Map<AgentKind, { score: number; matched: string[] }>();
    const lower = query;
    for (const [kind, keywords] of Object.entries(AGENT_KEYWORDS) as Array<[AgentKind, string[]]>) {
      const matched: string[] = [];
      for (const kw of keywords) {
        if (lower.includes(kw)) matched.push(kw);
      }
      if (matched.length > 0) {
        scores.set(kind, { score: matched.length, matched });
      }
    }
    if (scores.size === 0) {
      return { kind: 'general_info', confidence: 0.3, matchedKeywords: [] };
    }
    const ranked = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);
    const top = ranked[0]!;
    const totalMatched = ranked.reduce((s, [, v]) => s + v.score, 0);
    const confidence = +(top[1].score / Math.max(1, totalMatched)).toFixed(2);
    return {
      kind: top[0],
      confidence,
      matchedKeywords: top[1].matched,
    };
  }

  // Plan SC: FR-R628.3
  private fallback(primary: AgentKind, query: string): AgentKind[] {
    // 긴급 키워드가 쿼리에 포함되면 fallback으로 emergency 포함
    const fb: AgentKind[] = [];
    if (primary !== 'emergency' && AGENT_KEYWORDS.emergency.some((k) => query.includes(k))) {
      fb.push('emergency');
    }
    if (primary !== 'general_info') fb.push('general_info');
    return fb;
  }

  // Plan SC: FR-R628.4
  route(requestId: string, query: string, grade: DataGrade = DataGrade.O): RouteDecision {
    blockClassifiedData(grade);
    const sanitized = this.sanitize(query, grade);
    const intent = this.classify(sanitized);
    const fallbacks = this.fallback(intent.kind, sanitized);
    const decision: RouteDecision = {
      requestId,
      primaryAgent: intent.kind,
      fallbackAgents: fallbacks,
      intent,
      sanitizedQuery: sanitized,
    };
    this.routes.push(decision);
    this.log('ROUTE', { requestId, primary: intent.kind, confidence: intent.confidence });
    return decision;
  }

  // Plan SC: FR-R628.5
  listRoutes(): readonly RouteDecision[] {
    return this.routes;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
