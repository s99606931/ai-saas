// Design Ref: §핵심 알고리즘 — 스키마 검증 + 필수 필드 + 타입 체크
// Plan SC: FR-R243.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface FieldSchema {
  name: string;
  type: FieldType;
  required: boolean;
}

interface ContractSchema {
  path: string;
  method: string;
  fields: FieldSchema[];
}

interface ContractViolation {
  path: string;
  method: string;
  violationType: 'missing_field' | 'type_mismatch';
  fieldName: string;
  expected: string;
  actual: string;
  timestamp: string;
}

interface ValidationResult {
  path: string;
  method: string;
  valid: boolean;
  violations: ContractViolation[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R243.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function getFieldType(value: unknown): FieldType {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value as FieldType;
}

export class ApiContractTesterAI {
  private contracts = new Map<string, ContractSchema>();
  private violations: ContractViolation[] = [];
  private auditLog: AuditEntry[] = [];

  private contractKey(path: string, method: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R243.1
  registerContract(path: string, method: string, fields: FieldSchema[]): void {
    this.contracts.set(this.contractKey(path, method), { path, method, fields });
    this.log('REGISTER_CONTRACT', { path, method, fieldCount: fields.length });
  }

  // Plan SC: FR-R243.2 + R243.3 + R243.4
  validateResponse(path: string, method: string, response: Record<string, unknown>, grade: DataGrade = DataGrade.O): ValidationResult {
    guardDataGrade(grade);

    const contract = this.contracts.get(this.contractKey(path, method));
    if (!contract) {
      throw new Error(`계약 미등록: ${method} ${path}`);
    }

    const newViolations: ContractViolation[] = [];
    const timestamp = new Date().toISOString();

    for (const field of contract.fields) {
      const value = response[field.name];

      // Plan SC: FR-R243.3 — 필수 필드 누락
      if (field.required && (value === undefined || value === null)) {
        newViolations.push({
          path,
          method,
          violationType: 'missing_field',
          fieldName: field.name,
          expected: field.type,
          actual: 'undefined',
          timestamp,
        });
        continue;
      }

      // Plan SC: FR-R243.4 — 타입 불일치
      if (value !== undefined && value !== null) {
        const actualType = getFieldType(value);
        if (actualType !== field.type) {
          newViolations.push({
            path,
            method,
            violationType: 'type_mismatch',
            fieldName: field.name,
            expected: field.type,
            actual: actualType,
            timestamp,
          });
        }
      }
    }

    this.violations.push(...newViolations);
    this.log('VALIDATE_RESPONSE', { path, method, violationsCount: newViolations.length });
    return { path, method, valid: newViolations.length === 0, violations: newViolations };
  }

  getContractViolations(path?: string, method?: string): ContractViolation[] {
    if (path && method) {
      return this.violations.filter(v => v.path === path && v.method.toUpperCase() === method.toUpperCase());
    }
    if (path) {
      return this.violations.filter(v => v.path === path);
    }
    return [...this.violations];
  }

  // Plan SC: FR-R243.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
