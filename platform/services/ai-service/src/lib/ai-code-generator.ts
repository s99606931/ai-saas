// Design Ref: §R172 AI기반코드자동생성
// Plan SC: FR-R172.1~5

export type Language = 'typescript' | 'python' | 'java' | 'go';
export type CodeTemplate = 'crud' | 'service' | 'validator' | 'test';

export interface CodeSpec {
  language: Language;
  template: CodeTemplate;
  entityName: string;
  fields: Array<{ name: string; type: string; required: boolean }>;
  tenantId: string;
}

export interface GeneratedCode {
  specId: string;
  language: Language;
  template: CodeTemplate;
  entityName: string;
  code: string;
  lineCount: number;
  generatedAt: string;
}

export interface AuditEntry {
  action: string;
  specId?: string;
  tenantId?: string;
  timestamp: string;
}

export class AiCodeGenerator {
  private specs = new Map<string, CodeSpec>();
  private generated = new Map<string, GeneratedCode>();
  private auditLog: AuditEntry[] = [];
  private nextId = 1;

  // FR-R172.1 코드 스펙 등록
  registerSpec(spec: CodeSpec): string {
    const id = `spec-${this.nextId++}`;
    this.specs.set(id, spec);
    this.auditLog.push({ action: 'SPEC_REGISTERED', specId: id, tenantId: spec.tenantId, timestamp: new Date().toISOString() });
    return id;
  }

  // FR-R172.2 코드 생성 (템플릿 기반)
  generate(specId: string): GeneratedCode {
    const spec = this.specs.get(specId);
    if (!spec) throw new Error(`스펙 ${specId} 없음`);

    const code = this.buildCode(spec);
    const result: GeneratedCode = {
      specId,
      language: spec.language,
      template: spec.template,
      entityName: spec.entityName,
      code,
      lineCount: code.split('\n').length,
      generatedAt: new Date().toISOString(),
    };

    this.generated.set(specId, result);
    this.auditLog.push({ action: 'CODE_GENERATED', specId, tenantId: spec.tenantId, timestamp: new Date().toISOString() });
    return result;
  }

  // FR-R172.3 생성 이력 조회
  getGenerated(specId: string): GeneratedCode | undefined {
    return this.generated.get(specId);
  }

  // FR-R172.4 보안 검사 (하드코딩 시크릿 탐지 — CSAP D-12)
  securityCheck(code: string): string[] {
    const issues: string[] = [];
    if (/sk-[A-Za-z0-9]{20,}/.test(code)) issues.push('HARDCODED_API_KEY');
    if (/password\s*=\s*['"][^'"]+['"]/.test(code)) issues.push('HARDCODED_PASSWORD');
    if (/[A-Fa-f0-9]{32,}/.test(code)) issues.push('POTENTIAL_SECRET_HASH');
    return issues;
  }

  // FR-R172.5 감사 로그 (CSAP D-06)
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  private buildCode(spec: CodeSpec): string {
    const fieldLines = spec.fields
      .map((f) => `  ${f.name}${f.required ? '' : '?'}: ${f.type}`)
      .join('\n');

    if (spec.template === 'crud' && spec.language === 'typescript') {
      return [
        `// ${spec.entityName} CRUD — 자동 생성`,
        `export interface ${spec.entityName} {`,
        fieldLines,
        `}`,
        ``,
        `export class ${spec.entityName}Service {`,
        `  private store = new Map<string, ${spec.entityName}>()`,
        `  create(item: ${spec.entityName}): void { this.store.set(JSON.stringify(item), item) }`,
        `  findAll(): ${spec.entityName}[] { return Array.from(this.store.values()) }`,
        `}`,
      ].join('\n');
    }

    if (spec.template === 'validator') {
      const checks = spec.fields
        .filter((f) => f.required)
        .map((f) => `  if (!data.${f.name}) throw new Error('${f.name} 필수')`)
        .join('\n');
      return [`// ${spec.entityName} 검증 — 자동 생성`, `export function validate${spec.entityName}(data: any): void {`, checks, `}`].join('\n');
    }

    return `// ${spec.entityName} ${spec.template} — 자동 생성\nexport {}`;
  }
}
