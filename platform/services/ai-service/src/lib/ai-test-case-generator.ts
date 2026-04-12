// AI 테스트 케이스 자동 생성기 -- FR-N375.1~FR-N375.5
// Design Ref: MTU-N375 | CSAP: D-12

export interface ParamSpec {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly optional?: boolean;
  readonly min?: number;
  readonly max?: number;
}

export interface FunctionSignature {
  readonly name: string;
  readonly params: readonly ParamSpec[];
  readonly returnType: string;
  readonly throws?: readonly string[];
}

export interface TestCase {
  readonly caseId: string;
  readonly description: string;
  readonly inputs: Record<string, unknown>;
  readonly expectedBehavior: 'success' | 'exception' | 'boundary';
}

export interface TestGenAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: TestGenAuditEntry[] = [];

function recordAudit(entry: Omit<TestGenAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getTestGenAuditLog(tenantId: string): readonly TestGenAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

function defaultValue(p: ParamSpec): unknown {
  switch (p.type) {
    case 'string':
      return 'sample';
    case 'number':
      return p.min !== undefined ? p.min : 0;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
  }
}

function boundaryValues(p: ParamSpec): unknown[] {
  const out: unknown[] = [];
  if (p.type === 'number') {
    if (p.min !== undefined) out.push(p.min, p.min - 1);
    if (p.max !== undefined) out.push(p.max, p.max + 1);
    out.push(0);
  } else if (p.type === 'string') {
    out.push('', 'a'.repeat(1000));
  } else if (p.type === 'array') {
    out.push([], Array(100).fill(0));
  }
  return out;
}

export function generateHappyPath(sig: FunctionSignature): TestCase {
  const inputs: Record<string, unknown> = {};
  for (const p of sig.params) inputs[p.name] = defaultValue(p);
  return {
    caseId: `${sig.name}-happy`,
    description: `${sig.name} 정상 호출`,
    inputs,
    expectedBehavior: 'success',
  };
}

export function generateBoundaryCases(sig: FunctionSignature): readonly TestCase[] {
  const cases: TestCase[] = [];
  let idx = 0;
  for (const p of sig.params) {
    for (const v of boundaryValues(p)) {
      const inputs: Record<string, unknown> = {};
      for (const pp of sig.params) inputs[pp.name] = defaultValue(pp);
      inputs[p.name] = v;
      cases.push({
        caseId: `${sig.name}-bnd-${idx++}`,
        description: `${sig.name} 경계값: ${p.name}=${JSON.stringify(v).slice(0, 30)}`,
        inputs,
        expectedBehavior: 'boundary',
      });
    }
  }
  return cases;
}

export function generateExceptionCases(sig: FunctionSignature): readonly TestCase[] {
  const cases: TestCase[] = [];
  let idx = 0;
  for (const p of sig.params) {
    if (!p.optional) {
      const inputs: Record<string, unknown> = {};
      for (const pp of sig.params) if (pp.name !== p.name) inputs[pp.name] = defaultValue(pp);
      cases.push({
        caseId: `${sig.name}-exc-${idx++}`,
        description: `${sig.name} 필수 파라미터 누락: ${p.name}`,
        inputs,
        expectedBehavior: 'exception',
      });
    }
    // 타입 위반
    const inputs: Record<string, unknown> = {};
    for (const pp of sig.params) inputs[pp.name] = defaultValue(pp);
    inputs[p.name] = p.type === 'number' ? 'not-a-number' : 42;
    cases.push({
      caseId: `${sig.name}-exc-${idx++}`,
      description: `${sig.name} 타입 위반: ${p.name}`,
      inputs,
      expectedBehavior: 'exception',
    });
  }
  return cases;
}

export function generateAllCases(tenantId: string, sig: FunctionSignature): readonly TestCase[] {
  const happy = [generateHappyPath(sig)];
  const boundary = generateBoundaryCases(sig);
  const exception = generateExceptionCases(sig);
  const all = [...happy, ...boundary, ...exception];
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'TEST_CASES_GENERATED',
    target: sig.name,
    details: { total: all.length, happy: happy.length, boundary: boundary.length, exception: exception.length },
  });
  return all;
}

export function renderVitestCode(sig: FunctionSignature, cases: readonly TestCase[]): string {
  const lines: string[] = [];
  lines.push(`import { describe, it, expect } from 'vitest';`);
  lines.push(`import { ${sig.name} } from './${sig.name}';`);
  lines.push(``);
  lines.push(`describe('${sig.name}', () => {`);
  for (const c of cases) {
    const args = sig.params.map((p) => JSON.stringify(c.inputs[p.name])).join(', ');
    if (c.expectedBehavior === 'exception') {
      lines.push(`  it('${c.description}', () => {`);
      lines.push(`    expect(() => ${sig.name}(${args})).toThrow();`);
      lines.push(`  });`);
    } else {
      lines.push(`  it('${c.description}', () => {`);
      lines.push(`    const result = ${sig.name}(${args});`);
      lines.push(`    expect(result).toBeDefined();`);
      lines.push(`  });`);
    }
  }
  lines.push(`});`);
  return lines.join('\n');
}

export class AiTestCaseGeneratorService {
  constructor(private readonly tenantId: string) {}
  generate(sig: FunctionSignature): readonly TestCase[] {
    return generateAllCases(this.tenantId, sig);
  }
  render(sig: FunctionSignature, cases: readonly TestCase[]): string {
    return renderVitestCode(sig, cases);
  }
  getAuditLog(): readonly TestGenAuditEntry[] {
    return getTestGenAuditLog(this.tenantId);
  }
}
