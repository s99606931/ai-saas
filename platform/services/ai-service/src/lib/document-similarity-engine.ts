// 공공문서 유사도 분석 엔진 -- FR-N327.1~FR-N327.4
// Design Ref: MTU-N327 | CSAP: D-06, D-08

export interface DocumentVector { readonly docId: string; readonly title: string; readonly terms: Record<string, number>; readonly norm: number; }
export interface SimilarityResult { readonly docIdA: string; readonly docIdB: string; readonly similarity: number; readonly sharedTerms: readonly string[]; }
export interface DuplicateReport { readonly reportId: string; readonly tenantId: string; readonly totalDocuments: number; readonly duplicatePairs: readonly SimilarityResult[]; readonly threshold: number; readonly generatedAt: string; }
export interface DocSimAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DocSimAuditEntry[] = [];
function recordAudit(entry: Omit<DocSimAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDocSimAuditLog(tenantId: string): readonly DocSimAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

export function tokenize(text: string): string[] {
  return text.replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(t => t.length > 1);
}

export function buildTfIdf(docId: string, title: string, text: string): DocumentVector {
  const tokens = tokenize(text);
  const tf: Record<string, number> = {};
  for (const t of tokens) { tf[t] = (tf[t] ?? 0) + 1; }
  const total = tokens.length || 1;
  const terms: Record<string, number> = {};
  for (const [term, count] of Object.entries(tf)) { terms[term] = count / total; }
  const norm = Math.sqrt(Object.values(terms).reduce((s, v) => s + v * v, 0));
  return { docId, title, terms, norm };
}

export function cosineSimilarity(a: DocumentVector, b: DocumentVector): SimilarityResult {
  let dot = 0;
  const shared: string[] = [];
  for (const [term, weight] of Object.entries(a.terms)) {
    const bw = b.terms[term];
    if (bw !== undefined) { dot += weight * bw; shared.push(term); }
  }
  const sim = (a.norm > 0 && b.norm > 0) ? dot / (a.norm * b.norm) : 0;
  return { docIdA: a.docId, docIdB: b.docId, similarity: sim, sharedTerms: shared };
}

export function detectDuplicates(tenantId: string, vectors: DocumentVector[], threshold: number = 0.8): DuplicateReport {
  const pairs: SimilarityResult[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const vi = vectors[i];
      const vj = vectors[j];
      if (vi && vj) {
        const result = cosineSimilarity(vi, vj);
        if (result.similarity >= threshold) pairs.push(result);
      }
    }
  }
  recordAudit({ actor: 'system', tenantId, action: 'DUPLICATE_DETECTION_COMPLETED', target: tenantId, details: { documents: vectors.length, duplicates: pairs.length, threshold } });
  return { reportId: `dup-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, totalDocuments: vectors.length, duplicatePairs: pairs, threshold, generatedAt: new Date().toISOString() };
}

export class DocumentSimilarityService {
  constructor(private readonly tenantId: string) {}
  vectorize(docId: string, title: string, text: string): DocumentVector { return buildTfIdf(docId, title, text); }
  compare(a: DocumentVector, b: DocumentVector): SimilarityResult { return cosineSimilarity(a, b); }
  detectDuplicates(vectors: DocumentVector[], threshold?: number): DuplicateReport { return detectDuplicates(this.tenantId, vectors, threshold); }
  getAuditLog(): readonly DocSimAuditEntry[] { return getDocSimAuditLog(this.tenantId); }
}
