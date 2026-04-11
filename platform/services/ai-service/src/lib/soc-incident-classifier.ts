// SOC 인시던트 자동 분류 -- FR-N321.1~FR-N321.4
// Design Ref: MTU-N321 | CSAP: D-06, D-08

export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentCategory = 'malware' | 'phishing' | 'brute_force' | 'data_breach' | 'dos' | 'insider_threat' | 'unauthorized_access' | 'other';
export interface SecurityIncident { readonly incidentId: string; readonly tenantId: string; readonly title: string; readonly description: string; readonly sourceIp: string; readonly affectedAssets: string[]; readonly rawLogs: string; readonly reportedAt: string; }
export interface ClassificationResult { readonly classificationId: string; readonly incidentId: string; readonly category: IncidentCategory; readonly severity: IncidentSeverity; readonly confidence: number; readonly matchedIndicators: string[]; readonly suggestedPlaybook: string; readonly classifiedAt: string; }
export interface SOCAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: SOCAuditEntry[] = [];
function recordAudit(entry: Omit<SOCAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSOCAuditLog(tenantId: string): readonly SOCAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const CATEGORY_INDICATORS: Record<IncidentCategory, { keywords: string[]; playbook: string }> = {
  malware: { keywords: ['malware', '악성코드', 'trojan', 'ransomware', '바이러스', 'worm'], playbook: 'PB-MAL-001: 악성코드 대응' },
  phishing: { keywords: ['phishing', '피싱', '사칭', 'spoofing', '위장'], playbook: 'PB-PHI-001: 피싱 대응' },
  brute_force: { keywords: ['brute force', '무차별 대입', 'login failed', '로그인 실패', 'password spray'], playbook: 'PB-BF-001: 무차별 대입 대응' },
  data_breach: { keywords: ['data breach', '데이터 유출', '정보 유출', 'exfiltration', '반출'], playbook: 'PB-DB-001: 데이터 유출 대응' },
  dos: { keywords: ['dos', 'ddos', '서비스 거부', 'flood', '과부하'], playbook: 'PB-DOS-001: DDoS 대응' },
  insider_threat: { keywords: ['내부자', 'insider', '권한 남용', '비인가 접근'], playbook: 'PB-INS-001: 내부자 위협 대응' },
  unauthorized_access: { keywords: ['비인가', 'unauthorized', '무단 접근', '권한 없는'], playbook: 'PB-UA-001: 비인가 접근 대응' },
  other: { keywords: [], playbook: 'PB-GEN-001: 일반 인시던트 대응' },
};

export function classifyIncident(tenantId: string, incident: SecurityIncident): ClassificationResult {
  const text = `${incident.title} ${incident.description} ${incident.rawLogs}`.toLowerCase();
  let bestCategory: IncidentCategory = 'other';
  let bestScore = 0;
  const matchedIndicators: string[] = [];

  for (const [category, info] of Object.entries(CATEGORY_INDICATORS)) {
    const matched = info.keywords.filter(kw => text.includes(kw.toLowerCase()));
    const score = info.keywords.length > 0 ? matched.length / info.keywords.length : 0;
    if (score > bestScore) { bestScore = score; bestCategory = category as IncidentCategory; matchedIndicators.length = 0; matchedIndicators.push(...matched); }
  }

  // 심각도 결정
  let severity: IncidentSeverity = 'P4';
  if (bestCategory === 'data_breach' || bestCategory === 'malware') severity = 'P1';
  else if (bestCategory === 'brute_force' || bestCategory === 'dos') severity = 'P2';
  else if (bestCategory === 'phishing' || bestCategory === 'unauthorized_access') severity = 'P3';
  if (incident.affectedAssets.length >= 5) { const numSev = parseInt(severity.charAt(1)); severity = `P${Math.max(1, numSev - 1)}` as IncidentSeverity; }

  const result: ClassificationResult = {
    classificationId: `cls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, incidentId: incident.incidentId,
    category: bestCategory, severity, confidence: Math.min(0.95, bestScore + 0.3),
    matchedIndicators, suggestedPlaybook: CATEGORY_INDICATORS[bestCategory].playbook, classifiedAt: new Date().toISOString(),
  };

  recordAudit({ actor: 'system', tenantId, action: 'INCIDENT_CLASSIFIED', target: incident.incidentId, details: { category: bestCategory, severity, confidence: result.confidence } });
  return result;
}

export class SOCIncidentClassifierService {
  constructor(private readonly tenantId: string) {}
  classify(incident: SecurityIncident): ClassificationResult { return classifyIncident(this.tenantId, incident); }
  getAuditLog(): readonly SOCAuditEntry[] { return getSOCAuditLog(this.tenantId); }
}
