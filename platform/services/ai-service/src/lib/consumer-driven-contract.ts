// Consumer-Driven Contract 테스트 -- FR-N374.1~FR-N374.5
// Design Ref: MTU-N374 | CSAP: D-12

export interface ContractRequest {
  readonly method: string;
  readonly path: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

export interface ContractResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly bodySchema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
}

export interface Contract {
  readonly contractId: string;
  readonly consumer: string;
  readonly provider: string;
  readonly request: ContractRequest;
  readonly response: ContractResponse;
}

export interface ActualResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body: Record<string, unknown>;
}

export interface VerificationResult {
  readonly contractId: string;
  readonly passed: boolean;
  readonly violations: readonly string[];
}

export interface CompatibilityEntry {
  readonly consumer: string;
  readonly provider: string;
  readonly passed: number;
  readonly failed: number;
}

export interface ContractAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const contracts: Contract[] = [];
const auditLog: ContractAuditEntry[] = [];

function recordAudit(entry: Omit<ContractAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getContractAuditLog(tenantId: string): readonly ContractAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function registerContract(tenantId: string, contract: Contract): void {
  contracts.push(contract);
  recordAudit({
    actor: contract.consumer,
    tenantId,
    action: 'CONTRACT_REGISTERED',
    target: contract.contractId,
    details: { consumer: contract.consumer, provider: contract.provider },
  });
}

export function listContracts(provider?: string): readonly Contract[] {
  return provider ? contracts.filter((c) => c.provider === provider) : contracts;
}

function checkType(expected: string, actual: unknown): boolean {
  if (expected === 'array') return Array.isArray(actual);
  if (expected === 'object') return typeof actual === 'object' && actual !== null && !Array.isArray(actual);
  return typeof actual === expected;
}

export function verifyResponse(contract: Contract, actual: ActualResponse): VerificationResult {
  const violations: string[] = [];
  if (actual.status !== contract.response.status) {
    violations.push(`status: expected ${contract.response.status}, got ${actual.status}`);
  }
  for (const [field, expectedType] of Object.entries(contract.response.bodySchema)) {
    const value = actual.body[field];
    if (value === undefined) {
      violations.push(`missing field: ${field}`);
      continue;
    }
    if (!checkType(expectedType, value)) {
      violations.push(`field ${field}: expected ${expectedType}, got ${typeof value}`);
    }
  }
  return { contractId: contract.contractId, passed: violations.length === 0, violations };
}

export function verifyProvider(
  tenantId: string,
  provider: string,
  actualResponses: Map<string, ActualResponse>,
): readonly VerificationResult[] {
  const providerContracts = listContracts(provider);
  const results: VerificationResult[] = [];
  for (const c of providerContracts) {
    const actual = actualResponses.get(c.contractId);
    if (!actual) {
      results.push({ contractId: c.contractId, passed: false, violations: ['no actual response'] });
      continue;
    }
    results.push(verifyResponse(c, actual));
  }
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'PROVIDER_VERIFIED',
    target: provider,
    details: { passed, failed },
  });
  return results;
}

export function buildCompatibilityMatrix(results: readonly VerificationResult[]): readonly CompatibilityEntry[] {
  const map = new Map<string, CompatibilityEntry>();
  for (const r of results) {
    const c = contracts.find((x) => x.contractId === r.contractId);
    if (!c) continue;
    const key = `${c.consumer}->${c.provider}`;
    const cur = map.get(key) ?? { consumer: c.consumer, provider: c.provider, passed: 0, failed: 0 };
    if (r.passed) {
      map.set(key, { ...cur, passed: cur.passed + 1 });
    } else {
      map.set(key, { ...cur, failed: cur.failed + 1 });
    }
  }
  return Array.from(map.values());
}

export class ConsumerDrivenContractService {
  constructor(private readonly tenantId: string) {}
  register(c: Contract): void {
    registerContract(this.tenantId, c);
  }
  verify(provider: string, actual: Map<string, ActualResponse>) {
    return verifyProvider(this.tenantId, provider, actual);
  }
  matrix(results: readonly VerificationResult[]) {
    return buildCompatibilityMatrix(results);
  }
  getAuditLog(): readonly ContractAuditEntry[] {
    return getContractAuditLog(this.tenantId);
  }
}
