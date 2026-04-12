// 뮤테이션 테스트 AI 분석기 -- FR-N376.1~FR-N376.5
// Design Ref: MTU-N376 | CSAP: D-12

export type MutationOperator =
  | 'arithmetic_swap'
  | 'boolean_negate'
  | 'comparison_swap'
  | 'boundary_shift'
  | 'return_remove';

export interface Mutation {
  readonly mutationId: string;
  readonly operator: MutationOperator;
  readonly location: string;
  readonly original: string;
  readonly mutated: string;
}

export interface MutationResult {
  readonly mutationId: string;
  readonly killed: boolean;
  readonly killingTest?: string;
}

export interface MutationReport {
  readonly total: number;
  readonly killed: number;
  readonly survived: number;
  readonly score: number;
  readonly survivors: readonly Mutation[];
}

export interface MutationAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: MutationAuditEntry[] = [];

function recordAudit(entry: Omit<MutationAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getMutationAuditLog(tenantId: string): readonly MutationAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

const MUTATION_RULES: Array<{ op: MutationOperator; pattern: RegExp; replace: string }> = [
  { op: 'arithmetic_swap', pattern: /\+/g, replace: '-' },
  { op: 'boolean_negate', pattern: /===/g, replace: '!==' },
  { op: 'comparison_swap', pattern: />=/g, replace: '>' },
  { op: 'boundary_shift', pattern: /<=/g, replace: '<' },
  { op: 'return_remove', pattern: /return\s+[^;]+;/g, replace: 'return;' },
];

export function generateMutations(source: string, filePath: string): readonly Mutation[] {
  const mutations: Mutation[] = [];
  let idx = 0;
  for (const rule of MUTATION_RULES) {
    let match: RegExpExecArray | null;
    const re = new RegExp(rule.pattern.source, 'g');
    while ((match = re.exec(source)) !== null) {
      mutations.push({
        mutationId: `m-${idx++}`,
        operator: rule.op,
        location: `${filePath}:${match.index}`,
        original: match[0],
        mutated: rule.replace,
      });
    }
  }
  return mutations;
}

export function sampleMutations(mutations: readonly Mutation[], sampleSize: number): readonly Mutation[] {
  if (mutations.length <= sampleSize) return mutations;
  const copy = [...mutations];
  const sampled: Mutation[] = [];
  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    const item = copy.splice(idx, 1)[0];
    if (item) sampled.push(item);
  }
  return sampled;
}

export function analyzeResults(
  tenantId: string,
  mutations: readonly Mutation[],
  results: readonly MutationResult[],
): MutationReport {
  const killedSet = new Set(results.filter((r) => r.killed).map((r) => r.mutationId));
  const survivors = mutations.filter((m) => !killedSet.has(m.mutationId));
  const killed = mutations.length - survivors.length;
  const score = mutations.length > 0 ? killed / mutations.length : 0;
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'MUTATION_REPORT_GENERATED',
    target: 'mutation-batch',
    details: { total: mutations.length, killed, score },
  });
  return {
    total: mutations.length,
    killed,
    survived: survivors.length,
    score,
    survivors,
  };
}

export class MutationTestAnalyzerService {
  constructor(private readonly tenantId: string) {}
  generate(source: string, filePath: string): readonly Mutation[] {
    return generateMutations(source, filePath);
  }
  sample(mutations: readonly Mutation[], size: number): readonly Mutation[] {
    return sampleMutations(mutations, size);
  }
  analyze(mutations: readonly Mutation[], results: readonly MutationResult[]): MutationReport {
    return analyzeResults(this.tenantId, mutations, results);
  }
  getAuditLog(): readonly MutationAuditEntry[] {
    return getMutationAuditLog(this.tenantId);
  }
}
