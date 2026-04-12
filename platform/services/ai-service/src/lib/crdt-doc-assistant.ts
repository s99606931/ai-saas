// CRDT 문서 공동 편집 어시스턴트 -- FR-N381.1~FR-N381.5
// Design Ref: MTU-N381 | CSAP: D-06, D-08

export type CrdtOpType = 'insert' | 'delete';

export interface CrdtOp {
  readonly opId: string;
  readonly type: CrdtOpType;
  readonly position: number;
  readonly character?: string;
  readonly actorId: string;
  readonly timestamp: number;
  readonly causalDeps: readonly string[];
}

export interface DocState {
  readonly content: string;
  readonly appliedOps: readonly string[];
  readonly version: number;
}

export interface CrdtAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: CrdtAuditEntry[] = [];

function recordAudit(entry: Omit<CrdtAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getCrdtAuditLog(tenantId: string): readonly CrdtAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function createOp(
  type: CrdtOpType,
  position: number,
  actorId: string,
  character?: string,
  causalDeps: readonly string[] = [],
): CrdtOp {
  return {
    opId: `${actorId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    position,
    character,
    actorId,
    timestamp: Date.now(),
    causalDeps,
  };
}

export function canApply(op: CrdtOp, state: DocState): boolean {
  return op.causalDeps.every((dep) => state.appliedOps.includes(dep));
}

export function applyOp(tenantId: string, state: DocState, op: CrdtOp): DocState {
  if (!canApply(op, state)) {
    throw new Error(`인과 의존성 미충족: ${op.opId}`);
  }
  if (state.appliedOps.includes(op.opId)) return state;

  let content = state.content;
  if (op.type === 'insert' && op.character !== undefined) {
    const pos = Math.min(op.position, content.length);
    content = content.slice(0, pos) + op.character + content.slice(pos);
  } else if (op.type === 'delete') {
    const pos = Math.min(op.position, content.length - 1);
    if (pos >= 0) {
      content = content.slice(0, pos) + content.slice(pos + 1);
    }
  }

  const newState: DocState = {
    content,
    appliedOps: [...state.appliedOps, op.opId],
    version: state.version + 1,
  };

  recordAudit({
    actor: op.actorId,
    tenantId,
    action: 'CRDT_OP_APPLIED',
    target: op.opId,
    details: { type: op.type, position: op.position },
  });

  return newState;
}

export function mergeOps(tenantId: string, state: DocState, ops: readonly CrdtOp[]): DocState {
  // 인과 순서대로 정렬
  const sorted = [...ops].sort((a, b) => {
    if (a.causalDeps.includes(b.opId)) return 1;
    if (b.causalDeps.includes(a.opId)) return -1;
    return a.timestamp - b.timestamp;
  });
  let current = state;
  for (const op of sorted) {
    if (canApply(op, current)) {
      current = applyOp(tenantId, current, op);
    }
  }
  return current;
}

export interface EditSuggestion {
  readonly position: number;
  readonly suggestedText: string;
  readonly reason: string;
}

export function suggestEdits(content: string): readonly EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];
  // 단순 규칙: 이중 공백 탐지
  const doubleSpace = content.indexOf('  ');
  if (doubleSpace >= 0) {
    suggestions.push({
      position: doubleSpace,
      suggestedText: ' ',
      reason: '이중 공백 축소',
    });
  }
  // 문장 끝 마침표 누락
  if (content.length > 0 && !/[.!?。]$/.test(content.trim())) {
    suggestions.push({
      position: content.length,
      suggestedText: '.',
      reason: '문장 끝 마침표 제안',
    });
  }
  return suggestions;
}

export class CrdtDocAssistantService {
  constructor(private readonly tenantId: string) {}
  createInsert(position: number, character: string, actorId: string, deps: readonly string[] = []): CrdtOp {
    return createOp('insert', position, actorId, character, deps);
  }
  createDelete(position: number, actorId: string, deps: readonly string[] = []): CrdtOp {
    return createOp('delete', position, actorId, undefined, deps);
  }
  apply(state: DocState, op: CrdtOp): DocState {
    return applyOp(this.tenantId, state, op);
  }
  merge(state: DocState, ops: readonly CrdtOp[]): DocState {
    return mergeOps(this.tenantId, state, ops);
  }
  suggest(content: string): readonly EditSuggestion[] {
    return suggestEdits(content);
  }
  getAuditLog(): readonly CrdtAuditEntry[] {
    return getCrdtAuditLog(this.tenantId);
  }
}
