// 준수 증거 자동 수집 -- FR-N366.1~FR-N366.4
// Design Ref: MTU-N366 | CSAP: D-06, D-08, D-12

export interface EvidenceDefinition { readonly evidenceId: string; readonly regulation: string; readonly clause: string; readonly description: string; readonly collectionMethod: 'auto' | 'manual'; readonly schedule: string; }
export interface CollectedEvidence { readonly collectionId: string; readonly evidenceId: string; readonly data: string; readonly collectedAt: string; readonly source: string; readonly valid: boolean; }
export interface EvidencePackage { readonly packageId: string; readonly tenantId: string; readonly regulation: string; readonly evidences: readonly CollectedEvidence[]; readonly completionRate: number; readonly generatedAt: string; }
export interface EvidenceAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: EvidenceAuditEntry[] = [];
function recordAudit(entry: Omit<EvidenceAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getEvidenceAuditLog(tenantId: string): readonly EvidenceAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const defStore: EvidenceDefinition[] = [];
const collectedStore: CollectedEvidence[] = [];

export function defineEvidence(regulation: string, clause: string, description: string, method: EvidenceDefinition['collectionMethod'] = 'auto', schedule: string = 'daily'): EvidenceDefinition {
  const def: EvidenceDefinition = { evidenceId: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, regulation, clause, description, collectionMethod: method, schedule };
  defStore.push(def);
  return def;
}

export function collectEvidence(evidenceId: string, data: string, source: string): CollectedEvidence {
  const collected: CollectedEvidence = { collectionId: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, evidenceId, data, collectedAt: new Date().toISOString(), source, valid: data.length > 0 };
  collectedStore.push(collected);
  return collected;
}

export function generateEvidencePackage(tenantId: string, regulation: string): EvidencePackage {
  const defs = defStore.filter(d => d.regulation === regulation);
  const evidences = defs.map(d => {
    const collected = collectedStore.filter(c => c.evidenceId === d.evidenceId);
    return collected.length > 0 ? collected[collected.length - 1]! : { collectionId: 'missing', evidenceId: d.evidenceId, data: '', collectedAt: '', source: '', valid: false };
  });
  const valid = evidences.filter(e => e.valid).length;
  const rate = defs.length > 0 ? valid / defs.length : 0;
  recordAudit({ actor: 'system', tenantId, action: 'EVIDENCE_PACKAGE_GENERATED', target: regulation, details: { definitions: defs.length, collected: valid, rate } });
  return { packageId: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, regulation, evidences, completionRate: rate, generatedAt: new Date().toISOString() };
}

export class ComplianceEvidenceCollectorService {
  constructor(private readonly tenantId: string) {}
  define(reg: string, clause: string, desc: string, method?: EvidenceDefinition['collectionMethod']): EvidenceDefinition { return defineEvidence(reg, clause, desc, method); }
  collect(evidenceId: string, data: string, source: string): CollectedEvidence { return collectEvidence(evidenceId, data, source); }
  package(regulation: string): EvidencePackage { return generateEvidencePackage(this.tenantId, regulation); }
  getAuditLog(): readonly EvidenceAuditEntry[] { return getEvidenceAuditLog(this.tenantId); }
}
