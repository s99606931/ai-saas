// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R88.design.md
// Plan SC: FR-R88.1~5 (SVC-AI-ADV-R88 Petition Intent Hierarchy Classifier)
// CSAP: D-06 감사

export interface CategoryNode {
  id: string;
  label: string;
  keywords: string[];
  children?: CategoryNode[];
}

export interface ClassifyResult {
  path: string[];
  labels: string[];
  confidence: number;
  unknown: boolean;
}

export interface AuditEvent {
  ts: string;
  action: 'REGISTER' | 'CLASSIFY' | 'UNKNOWN';
  details: Record<string, unknown>;
}

const DEFAULT_UNKNOWN_THRESHOLD = 0.2;

export class PetitionIntentHierarchyClassifier {
  private roots: CategoryNode[] = [];
  private readonly auditLog: AuditEvent[] = [];
  private readonly unknownThreshold: number;

  constructor(threshold = DEFAULT_UNKNOWN_THRESHOLD) {
    this.unknownThreshold = threshold;
  }

  /** FR-R88.1 */
  registerTaxonomy(roots: CategoryNode[]): void {
    this.roots = roots.map(cloneNode);
    this.log('REGISTER', { roots: roots.length });
  }

  /** FR-R88.2~4 */
  classify(text: string): ClassifyResult {
    const q = text.toLowerCase();
    const path: string[] = [];
    const labels: string[] = [];
    let nodes: CategoryNode[] = this.roots;
    let totalScore = 0;
    let depth = 0;

    while (nodes.length > 0) {
      let best: { node: CategoryNode; score: number; direct: number } | null = null;
      for (const n of nodes) {
        const direct = this.score(q, n, depth);
        const subtree = this.subtreeScore(q, n);
        const combined = direct + subtree * 0.5;
        if (!best || combined > best.score) best = { node: n, score: combined, direct };
      }
      if (!best || best.score === 0) break;
      path.push(best.node.id);
      labels.push(best.node.label);
      totalScore += Math.max(best.direct, best.score);
      nodes = best.node.children ?? [];
      depth++;
    }

    const avgScore = path.length === 0 ? 0 : totalScore / path.length;
    const unknown = path.length === 0 || avgScore < this.unknownThreshold;

    if (unknown) {
      this.log('UNKNOWN', { text: q.slice(0, 40), avgScore });
    } else {
      this.log('CLASSIFY', { path, avgScore });
    }

    return {
      path,
      labels,
      confidence: Math.min(1, Number(avgScore.toFixed(3))),
      unknown,
    };
  }

  /** FR-R88.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private score(query: string, node: CategoryNode, depth: number): number {
    if (node.keywords.length === 0) return 0;
    const matched = node.keywords.filter((k) => query.includes(k.toLowerCase())).length;
    const base = matched / node.keywords.length;
    const depthBoost = 1 + depth * 0.2;
    return base * depthBoost;
  }

  private subtreeScore(query: string, node: CategoryNode): number {
    let max = 0;
    if (node.children) {
      for (const c of node.children) {
        const s = this.score(query, c, 0);
        if (s > max) max = s;
        const sub = this.subtreeScore(query, c);
        if (sub > max) max = sub;
      }
    }
    return max;
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

function cloneNode(n: CategoryNode): CategoryNode {
  return {
    id: n.id,
    label: n.label,
    keywords: [...n.keywords],
    children: n.children?.map(cloneNode),
  };
}

export function createPetitionIntentHierarchyClassifier(
  threshold?: number,
): PetitionIntentHierarchyClassifier {
  return new PetitionIntentHierarchyClassifier(threshold);
}
