// 법규 개정 자동 추적 -- FR-N315.1~FR-N315.4
// Design Ref: MTU-N315 | CSAP: D-06, D-12

export interface LawEntry { readonly lawId: string; readonly name: string; readonly currentVersion: string; readonly lastRevisionDate: string; readonly category: string; }
export interface RevisionChange { readonly changeId: string; readonly lawId: string; readonly revisionDate: string; readonly changeType: 'added' | 'modified' | 'deleted'; readonly articleNo: string; readonly beforeText: string; readonly afterText: string; readonly summary: string; }
export interface ImpactAlert { readonly alertId: string; readonly tenantId: string; readonly lawId: string; readonly lawName: string; readonly severity: 'critical' | 'high' | 'medium' | 'low'; readonly affectedAreas: string[]; readonly message: string; readonly createdAt: string; }
export interface LawAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: LawAuditEntry[] = [];
function recordAudit(entry: Omit<LawAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getLawAuditLog(tenantId: string): readonly LawAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const lawStore: Map<string, LawEntry[]> = new Map();

export function registerLaw(tenantId: string, name: string, version: string, category: string): LawEntry {
  const law: LawEntry = { lawId: `law-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, currentVersion: version, lastRevisionDate: new Date().toISOString(), category };
  const existing = lawStore.get(tenantId) ?? [];
  existing.push(law);
  lawStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'LAW_REGISTERED', target: law.lawId, details: { name, category } });
  return law;
}

export function detectRevisions(tenantId: string, lawId: string, previousText: string, currentText: string): RevisionChange[] {
  const changes: RevisionChange[] = [];
  const prevLines = previousText.split('\n').filter(l => l.trim().length > 0);
  const currLines = currentText.split('\n').filter(l => l.trim().length > 0);
  const maxLen = Math.max(prevLines.length, currLines.length);
  for (let i = 0; i < maxLen; i++) {
    const prev = prevLines[i] ?? '';
    const curr = currLines[i] ?? '';
    if (prev !== curr) {
      let changeType: RevisionChange['changeType'] = 'modified';
      if (prev === '') changeType = 'added';
      else if (curr === '') changeType = 'deleted';
      changes.push({ changeId: `rev-${Date.now()}-${i}`, lawId, revisionDate: new Date().toISOString(), changeType, articleNo: `제${i + 1}조`, beforeText: prev, afterText: curr, summary: `${changeType}: 제${i + 1}조 변경` });
    }
  }
  recordAudit({ actor: 'system', tenantId, action: 'REVISIONS_DETECTED', target: lawId, details: { changesFound: changes.length } });
  return changes;
}

const AREA_KEYWORDS: Record<string, string[]> = {
  '보안': ['보안', '암호화', '접근통제', '인증'],
  '개인정보': ['개인정보', '정보주체', 'PII', '동의'],
  '데이터': ['데이터', '정보', '공공데이터', '개방'],
  '행정': ['행정', '절차', '허가', '인가'],
};

export function assessRevisionImpact(tenantId: string, law: LawEntry, changes: RevisionChange[]): ImpactAlert[] {
  const alerts: ImpactAlert[] = [];
  const allText = changes.map(c => `${c.beforeText} ${c.afterText}`).join(' ');
  const affectedAreas: string[] = [];
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (keywords.some(kw => allText.includes(kw))) affectedAreas.push(area);
  }
  if (changes.length > 0) {
    let severity: ImpactAlert['severity'] = 'low';
    if (changes.length >= 5) severity = 'critical';
    else if (changes.length >= 3) severity = 'high';
    else if (changes.length >= 2) severity = 'medium';
    alerts.push({ alertId: `alert-${Date.now()}`, tenantId, lawId: law.lawId, lawName: law.name, severity, affectedAreas, message: `${law.name}: ${changes.length}건 개정 사항 탐지`, createdAt: new Date().toISOString() });
  }
  return alerts;
}

export class LawRevisionTrackerService {
  constructor(private readonly tenantId: string) {}
  register(name: string, version: string, category: string): LawEntry { return registerLaw(this.tenantId, name, version, category); }
  detect(lawId: string, prev: string, curr: string): RevisionChange[] { return detectRevisions(this.tenantId, lawId, prev, curr); }
  assess(law: LawEntry, changes: RevisionChange[]): ImpactAlert[] { return assessRevisionImpact(this.tenantId, law, changes); }
  getAuditLog(): readonly LawAuditEntry[] { return getLawAuditLog(this.tenantId); }
}
