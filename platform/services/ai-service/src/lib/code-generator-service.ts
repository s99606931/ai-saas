// Design Ref: MTU-N487 §AI 코드 생성 엔진
// Plan SC: FR-CG.1~5

export interface ServiceTemplate {
  id: string;
  name: string;
  framework: 'fastify' | 'nestjs' | 'express';
  files: string[];
}

export interface ServiceSpec {
  name: string;
  routes: Array<{ method: string; path: string; handler: string }>;
  models: Array<{ name: string; fields: Record<string, string> }>;
}

export interface GeneratedArtifact {
  path: string;
  content: string;
}

export interface QualityReport {
  artifacts: number;
  hasTests: boolean;
  hasTypes: boolean;
  passes: boolean;
}

export class CodeGeneratorService {
  private templates = new Map<string, ServiceTemplate>();

  /** FR-CG.1 템플릿 카탈로그 */
  registerTemplate(t: ServiceTemplate): void {
    this.templates.set(t.id, t);
  }

  listTemplates(): ServiceTemplate[] {
    return Array.from(this.templates.values());
  }

  /** FR-CG.2 스펙 → 스켈레톤 */
  generateFromSpec(spec: ServiceSpec, templateId: string): GeneratedArtifact[] {
    const t = this.templates.get(templateId);
    if (!t) throw new Error('템플릿 없음');
    const out: GeneratedArtifact[] = [];
    // index
    out.push({
      path: `src/index.ts`,
      content: `// Generated from spec: ${spec.name}\nimport Fastify from 'fastify';\nconst app = Fastify();\nexport default app;\n`,
    });
    // 라우트 파일
    out.push({ path: `src/routes.ts`, content: this.generateRoutes(spec) });
    // 모델
    out.push({ path: `src/models.ts`, content: this.generateModels(spec) });
    // 테스트
    out.push({ path: `tests/smoke.test.ts`, content: this.generateSmokeTest(spec) });
    return out;
  }

  /** FR-CG.3 라우트 생성 */
  private generateRoutes(spec: ServiceSpec): string {
    const lines: string[] = [`import type { FastifyInstance } from 'fastify';`, ``];
    lines.push(`export async function registerRoutes(app: FastifyInstance) {`);
    for (const r of spec.routes) {
      lines.push(`  app.${r.method.toLowerCase()}('${r.path}', async () => ({ handler: '${r.handler}' }));`);
    }
    lines.push(`}`);
    return lines.join('\n');
  }

  /** FR-CG.3 스키마 생성 */
  private generateModels(spec: ServiceSpec): string {
    const lines: string[] = [];
    for (const m of spec.models) {
      lines.push(`export interface ${m.name} {`);
      for (const [k, v] of Object.entries(m.fields)) lines.push(`  ${k}: ${v};`);
      lines.push(`}`);
    }
    return lines.join('\n');
  }

  /** FR-CG.4 테스트 뼈대 */
  private generateSmokeTest(spec: ServiceSpec): string {
    return [
      `import { describe, it, expect } from 'vitest';`,
      `describe('${spec.name}', () => {`,
      `  it('should start', () => { expect(true).toBe(true); });`,
      `});`,
    ].join('\n');
  }

  /** FR-CG.5 품질 게이트 */
  runQualityGate(artifacts: GeneratedArtifact[]): QualityReport {
    const hasTests = artifacts.some((a) => a.path.includes('test'));
    const hasTypes = artifacts.some((a) => a.content.includes('interface '));
    return {
      artifacts: artifacts.length,
      hasTests,
      hasTypes,
      passes: hasTests && hasTypes && artifacts.length >= 3,
    };
  }
}

export const codeGeneratorService = new CodeGeneratorService();
