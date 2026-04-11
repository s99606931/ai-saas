// AI 기반 인시던트 자동 분류 -- FR-N274.1~FR-N274.6
// Design Ref: MTU-N274 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 인시던트 카테고리 -- Design §1 */
export type IncidentCategory =
  | 'infrastructure'
  | 'security'
  | 'application'
  | 'database'
  | 'network'
  | 'performance'
  | 'user_error'
  | 'unknown';

/** 심각도 -- Design §2 */
export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';

/** 인시던트 -- Design §1 */
export interface Incident {
  id: string;
  title: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  status: 'open' | 'classified' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
}

/** 분류 결과 -- Design §1~§3 */
export interface ClassificationResult {
  incidentId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  confidence: number;
  assignedTeam: string;
  assignedPerson?: string;
  matchedKeywords: string[];
  classifiedAt: string;
}

/** 유사 인시던트 -- Design §4 */
export interface SimilarIncident {
  incidentId: string;
  title: string;
  category: IncidentCategory;
  resolution: string;
  similarity: number;
}

/** 패턴 분석 결과 -- Design §5 */
export interface PatternAnalysis {
  patterns: IncidentPattern[];
  preventionSuggestions: string[];
  analyzedAt: string;
}

/** 인시던트 패턴 */
export interface IncidentPattern {
  category: IncidentCategory;
  frequency: number;
  timePattern: string;
  description: string;
}

/** 팀 라우팅 규칙 */
export interface TeamRoutingRule {
  category: IncidentCategory;
  teamName: string;
  escalationTeam?: string;
}

/** 감사 항목 */
export interface IncidentAuditEntry {
  id: string;
  action: string;
  actor: string;
  incidentId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 저장소 ──────────────────────────────────────────────────────────────────

const incidents = new Map<string, Incident>();
const classifications = new Map<string, ClassificationResult>();
const resolvedIncidents: { incident: Incident; classification: ClassificationResult; resolution: string }[] = [];
const auditLog: IncidentAuditEntry[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown>): void {
  auditLog.push({ id: randomUUID(), action, actor, details, timestamp: new Date().toISOString() });
}

export function getIncidentAuditLog(): IncidentAuditEntry[] {
  return [...auditLog];
}

// -- §1 카테고리 분류 ────────────────────────────────────────────────────────

/** 카테고리별 키워드 */
const CATEGORY_KEYWORDS: Record<IncidentCategory, string[]> = {
  infrastructure: ['서버', '노드', 'k3s', '쿠버네티스', '컨테이너', 'pod', '디스크', 'CPU', '메모리', 'OOM'],
  security: ['보안', '침입', '취약점', '인증', '권한', '해킹', '악성', 'DDoS', '방화벽', '차단'],
  application: ['에러', '오류', '예외', 'exception', '크래시', '응답 없음', 'NullPointer', '500'],
  database: ['데이터베이스', 'DB', 'PostgreSQL', '쿼리', '데드락', '커넥션', '트랜잭션', '복제'],
  network: ['네트워크', '연결', 'DNS', '타임아웃', '지연', '패킷', 'SSL', 'TLS', '인그레스'],
  performance: ['성능', '느림', '지연', '응답시간', '레이턴시', '처리량', '병목', 'SLO'],
  user_error: ['사용자', '잘못된 입력', '실수', '로그인 실패', '권한 부족'],
  unknown: [],
};

/** 인시던트 텍스트 분류 -- FR-N274.1 */
export function classifyIncident(
  incident: Incident,
  actor: string
): ClassificationResult {
  incidents.set(incident.id, incident);

  const text = `${incident.title} ${incident.description}`.toLowerCase();
  const categoryScores: { category: IncidentCategory; score: number; keywords: string[] }[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'unknown') continue;
    const matched = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    categoryScores.push({
      category: category as IncidentCategory,
      score: matched.length,
      keywords: matched,
    });
  }

  categoryScores.sort((a, b) => b.score - a.score);
  const best = categoryScores[0];
  const category: IncidentCategory = best && best.score > 0 ? best.category : 'unknown';
  const confidence = best && best.score > 0 ? Math.min(1, best.score / 3) : 0.1;

  // 심각도 판정
  const severity = determineSeverity(text, category);

  // 팀 배정
  const assignedTeam = routeToTeam(category);

  const result: ClassificationResult = {
    incidentId: incident.id,
    category,
    severity,
    confidence,
    assignedTeam,
    matchedKeywords: best?.keywords ?? [],
    classifiedAt: new Date().toISOString(),
  };

  classifications.set(incident.id, result);
  incident.status = 'classified';

  recordAudit('INCIDENT_CLASSIFIED', actor, {
    incidentId: incident.id,
    category,
    severity,
    assignedTeam,
  });

  return result;
}

// -- §2 심각도 판정 ──────────────────────────────────────────────────────────

const CRITICAL_KEYWORDS = ['다운', '중단', '전면 장애', '데이터 유실', '보안 침해', '서비스 불가'];
const HIGH_KEYWORDS = ['장애', '오류 다수', '성능 저하', '응답 지연', '접근 불가'];

/** 심각도 판정 -- FR-N274.2 */
function determineSeverity(text: string, category: IncidentCategory): IncidentSeverity {
  if (CRITICAL_KEYWORDS.some((kw) => text.includes(kw))) return 'P1';
  if (HIGH_KEYWORDS.some((kw) => text.includes(kw))) return 'P2';
  if (category === 'security') return 'P2';
  if (category === 'infrastructure') return 'P3';
  return 'P4';
}

// -- §3 자동 배정 ────────────────────────────────────────────────────────────

/** 카테고리-팀 매핑 */
const DEFAULT_ROUTING: TeamRoutingRule[] = [
  { category: 'infrastructure', teamName: '인프라팀', escalationTeam: 'SRE팀' },
  { category: 'security', teamName: '보안팀', escalationTeam: 'CISO' },
  { category: 'application', teamName: '개발팀' },
  { category: 'database', teamName: 'DBA팀' },
  { category: 'network', teamName: '네트워크팀' },
  { category: 'performance', teamName: 'SRE팀' },
  { category: 'user_error', teamName: '고객지원팀' },
  { category: 'unknown', teamName: '운영팀' },
];

/** 팀 라우팅 -- FR-N274.3 */
function routeToTeam(category: IncidentCategory): string {
  const rule = DEFAULT_ROUTING.find((r) => r.category === category);
  return rule?.teamName || '운영팀';
}

// -- §4 유사 인시던트 검색 ────────────────────────────────────────────────────

/** 유사 인시던트 검색 -- FR-N274.4 */
export function findSimilarIncidents(incidentId: string, limit: number = 5): SimilarIncident[] {
  const incident = incidents.get(incidentId);
  if (!incident) return [];

  const incidentKeywords = extractKeywords(`${incident.title} ${incident.description}`);

  const results: SimilarIncident[] = [];
  for (const resolved of resolvedIncidents) {
    const resolvedKeywords = extractKeywords(`${resolved.incident.title} ${resolved.incident.description}`);
    const commonKeywords = incidentKeywords.filter((kw) => resolvedKeywords.includes(kw));
    const similarity = incidentKeywords.length > 0
      ? commonKeywords.length / incidentKeywords.length
      : 0;

    if (similarity > 0.2) {
      results.push({
        incidentId: resolved.incident.id,
        title: resolved.incident.title,
        category: resolved.classification.category,
        resolution: resolved.resolution,
        similarity,
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

function extractKeywords(text: string): string[] {
  return text.toLowerCase().split(/[\s,;.!?]+/).filter((w) => w.length >= 2);
}

/** 해결된 인시던트 등록 (학습용) */
export function registerResolution(incidentId: string, resolution: string, actor: string): void {
  const incident = incidents.get(incidentId);
  const classification = classifications.get(incidentId);
  if (incident && classification) {
    incident.status = 'resolved';
    resolvedIncidents.push({ incident, classification, resolution });
    recordAudit('INCIDENT_RESOLVED', actor, { incidentId, resolution: resolution.substring(0, 100) });
  }
}

// -- §5 패턴 분석 ────────────────────────────────────────────────────────────

/** 인시던트 패턴 분석 -- FR-N274.5 */
export function analyzePatterns(actor: string): PatternAnalysis {
  const categoryFrequency = new Map<IncidentCategory, number>();

  for (const resolved of resolvedIncidents) {
    const cat = resolved.classification.category;
    categoryFrequency.set(cat, (categoryFrequency.get(cat) || 0) + 1);
  }

  const patterns: IncidentPattern[] = [];
  for (const [category, frequency] of categoryFrequency) {
    if (frequency >= 2) {
      patterns.push({
        category,
        frequency,
        timePattern: '주기적',
        description: `${category} 카테고리 인시던트 ${frequency}건 반복 발생`,
      });
    }
  }

  const preventionSuggestions = patterns.map((p) => {
    switch (p.category) {
      case 'infrastructure': return '인프라 자동 스케일링 및 모니터링 강화 권장';
      case 'security': return '보안 정책 점검 및 취약점 스캔 자동화 권장';
      case 'application': return '코드 리뷰 강화 및 CI/CD 품질 게이트 추가 권장';
      case 'database': return 'DB 쿼리 최적화 및 커넥션 풀 모니터링 권장';
      default: return `${p.category} 관련 예방 조치 검토 필요`;
    }
  });

  recordAudit('PATTERN_ANALYZED', actor, { patternCount: patterns.length });

  return {
    patterns,
    preventionSuggestions,
    analyzedAt: new Date().toISOString(),
  };
}

// -- 조회 ────────────────────────────────────────────────────────────────────

export function getIncident(id: string): Incident | undefined {
  return incidents.get(id);
}

export function getClassification(incidentId: string): ClassificationResult | undefined {
  return classifications.get(incidentId);
}
