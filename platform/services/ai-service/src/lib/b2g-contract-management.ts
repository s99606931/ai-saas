// B2G 계약 관리 AI -- FR-N293.1~FR-N293.6
// Design Ref: MTU-N293 | CSAP: D-06, D-08, D-12

export type ContractStatus = 'draft' | 'active' | 'completed' | 'terminated';

export interface Contract {
  readonly contractId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly counterparty: string; // 발주기관
  readonly startDate: string;
  readonly endDate: string;
  readonly amountKrw: number;
  readonly status: ContractStatus;
  readonly text: string;
}

export interface ContractObligation {
  readonly obligationId: string;
  readonly contractId: string;
  readonly description: string;
  readonly dueDate: string;
  readonly status: 'pending' | 'fulfilled' | 'overdue';
}

export interface ContractAlert {
  readonly alertId: string;
  readonly contractId: string;
  readonly type: 'deadline' | 'overdue' | 'expiring';
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly createdAt: string;
}

export interface ContractAuditEntry {
  readonly timestamp: string;
  readonly tenantId: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: ContractAuditEntry[] = [];
const contractStore = new Map<string, Contract>();
const obligationStore = new Map<string, ContractObligation[]>();

function recordAudit(entry: Omit<ContractAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getContractAuditLog(tenantId: string): readonly ContractAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

// FR-N293.1: 계약서 등록
export function registerContract(contract: Contract): void {
  contractStore.set(contract.contractId, contract);
  recordAudit({
    tenantId: contract.tenantId,
    actor: 'system',
    action: 'CONTRACT_REGISTERED',
    target: contract.contractId,
    details: { title: contract.title, amountKrw: contract.amountKrw },
  });
}

export function getContract(contractId: string): Contract | undefined {
  return contractStore.get(contractId);
}

// FR-N293.2: 의무사항 자동 추출
const OBLIGATION_PATTERNS: ReadonlyArray<{ regex: RegExp; description: string }> = [
  { regex: /(\d{4}-\d{2}-\d{2})\s*까지\s*(.+)/g, description: '기한 명시 의무' },
  { regex: /월간\s*(.+?)\s*보고/g, description: '월간 보고 의무' },
  { regex: /분기별\s*(.+?)\s*제출/g, description: '분기 제출 의무' },
];

export function extractObligations(contract: Contract): ContractObligation[] {
  const out: ContractObligation[] = [];
  const lines = contract.text.split('\n');
  for (const line of lines) {
    for (const { regex, description } of OBLIGATION_PATTERNS) {
      const matches = [...line.matchAll(regex)];
      for (const m of matches) {
        const dueDate = m[1] && /\d{4}-\d{2}-\d{2}/.test(m[1]) ? m[1] : contract.endDate;
        out.push({
          obligationId: `oblig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          contractId: contract.contractId,
          description: `${description}: ${m[0].slice(0, 60)}`,
          dueDate,
          status: 'pending',
        });
      }
    }
  }
  obligationStore.set(contract.contractId, out);
  recordAudit({
    tenantId: contract.tenantId,
    actor: 'system',
    action: 'OBLIGATIONS_EXTRACTED',
    target: contract.contractId,
    details: { count: out.length },
  });
  return out;
}

export function listObligations(contractId: string): readonly ContractObligation[] {
  return obligationStore.get(contractId) ?? [];
}

// FR-N293.3: 이행 모니터링 + 알림
export function monitorContractDeadlines(tenantId: string, today: Date = new Date()): ContractAlert[] {
  const alerts: ContractAlert[] = [];
  for (const contract of contractStore.values()) {
    if (contract.tenantId !== tenantId) continue;
    if (contract.status !== 'active') continue;

    const endDate = new Date(contract.endDate);
    const daysToEnd = Math.floor((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (daysToEnd >= 0 && daysToEnd <= 30) {
      alerts.push({
        alertId: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        contractId: contract.contractId,
        type: 'expiring',
        message: `계약 만료 ${daysToEnd}일 전`,
        severity: daysToEnd <= 7 ? 'critical' : 'warning',
        createdAt: new Date().toISOString(),
      });
    }

    const obligations = obligationStore.get(contract.contractId) ?? [];
    for (const o of obligations) {
      const due = new Date(o.dueDate);
      if (o.status === 'pending' && due < today) {
        alerts.push({
          alertId: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          contractId: contract.contractId,
          type: 'overdue',
          message: `의무 이행 지연: ${o.description}`,
          severity: 'critical',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  recordAudit({
    tenantId,
    actor: 'system',
    action: 'DEADLINE_MONITOR',
    target: tenantId,
    details: { alerts: alerts.length },
  });
  return alerts;
}

// FR-N293.4: 의무 이행 처리
export function fulfillObligation(contractId: string, obligationId: string, actor: string, tenantId: string): boolean {
  const list = obligationStore.get(contractId);
  if (!list) return false;
  const idx = list.findIndex((o) => o.obligationId === obligationId);
  if (idx < 0) return false;
  const current = list[idx];
  if (!current) return false;
  list[idx] = { ...current, status: 'fulfilled' };
  recordAudit({
    tenantId,
    actor,
    action: 'OBLIGATION_FULFILLED',
    target: obligationId,
    details: { contractId },
  });
  return true;
}

// FR-N293.5 + FR-N293.6 Service
export class B2GContractManagementService {
  constructor(private readonly tenantId: string) {}

  register(contract: Omit<Contract, 'tenantId'>): void {
    registerContract({ ...contract, tenantId: this.tenantId });
  }

  extract(contractId: string): ContractObligation[] {
    const c = contractStore.get(contractId);
    if (!c) return [];
    return extractObligations(c);
  }

  monitor(today?: Date): ContractAlert[] {
    return monitorContractDeadlines(this.tenantId, today);
  }

  fulfill(contractId: string, obligationId: string, actor: string): boolean {
    return fulfillObligation(contractId, obligationId, actor, this.tenantId);
  }

  obligations(contractId: string): readonly ContractObligation[] {
    return listObligations(contractId);
  }

  audit(): readonly ContractAuditEntry[] {
    return getContractAuditLog(this.tenantId);
  }
}
