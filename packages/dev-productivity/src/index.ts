/**
 * 개발자 생산성 파사드 (MTU-N487~N490)
 */

// ============ MTU-N487: Code Generator ============

export interface ServiceSpec {
  serviceName: string;
  namespace: string;
  routes: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    schema: string;
  }>;
}

export class ServiceSkeletonGenerator {
  generate(spec: ServiceSpec): { files: Array<{ path: string; content: string }> } {
    const files: Array<{ path: string; content: string }> = [];

    const routesContent = [
      `// Generated: ${spec.serviceName} routes`,
      `import type { FastifyInstance } from 'fastify';`,
      '',
      `export async function ${spec.serviceName}Routes(app: FastifyInstance): Promise<void> {`,
      ...spec.routes.map(
        (r) => `  app.${r.method.toLowerCase()}('${r.path}', async (_req, _reply) => ({ ok: true }));`,
      ),
      '}',
    ].join('\n');
    files.push({ path: `src/routes/${spec.serviceName}.routes.ts`, content: routesContent });

    const testContent = [
      `// Generated test skeleton`,
      `describe('${spec.serviceName}', () => {`,
      ...spec.routes.map((r) => `  it.todo('${r.method} ${r.path}');`),
      '});',
    ].join('\n');
    files.push({ path: `tests/${spec.serviceName}.test.ts`, content: testContent });

    return { files };
  }
}

// ============ MTU-N488: Tech Debt Quantifier ============

export interface CodeMetric {
  filePath: string;
  linesOfCode: number;
  complexity: number;
  duplicateRatio: number;
  testCoverage: number;
  lastModified: string;
}

export class TechDebtScorer {
  /**
   * 부채 스코어: 0-100 (높을수록 나쁨)
   */
  score(metric: CodeMetric): number {
    let score = 0;
    if (metric.linesOfCode > 800) score += 20;
    if (metric.complexity > 20) score += 25;
    if (metric.duplicateRatio > 0.1) score += 20;
    if (metric.testCoverage < 0.6) score += 25;
    const age = Date.now() - new Date(metric.lastModified).getTime();
    const years = age / (1000 * 60 * 60 * 24 * 365);
    if (years > 2) score += 10;
    return Math.min(100, score);
  }

  /**
   * 우선순위 매트릭스 (영향 × 긴급도)
   */
  prioritize(metrics: CodeMetric[]): Array<{
    filePath: string;
    debtScore: number;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    recommendation: string;
  }> {
    return metrics
      .map((m) => {
        const debtScore = this.score(m);
        let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';
        let recommendation = '모니터링만 유지';
        if (debtScore >= 80) {
          priority = 'P0';
          recommendation = '즉시 리팩토링 필요';
        } else if (debtScore >= 60) {
          priority = 'P1';
          recommendation = '다음 스프린트 리팩토링';
        } else if (debtScore >= 40) {
          priority = 'P2';
          recommendation = '분기 계획 반영';
        }
        return { filePath: m.filePath, debtScore, priority, recommendation };
      })
      .sort((a, b) => b.debtScore - a.debtScore);
  }
}

// ============ MTU-N489: Dependency Auto PR ============

export interface VulnerableDependency {
  name: string;
  currentVersion: string;
  fixedVersion: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cve: string;
}

export interface AutoUpdatePr {
  branchName: string;
  title: string;
  body: string;
  changes: Array<{ file: string; from: string; to: string }>;
}

export class DependencyAutoPrGenerator {
  generate(vulns: VulnerableDependency[]): AutoUpdatePr {
    const critical = vulns.filter((v) => v.severity === 'critical' || v.severity === 'high');
    const branchName = `fix/deps-${Date.now()}`;
    const title = `chore(deps): ${vulns.length}개 의존성 보안 업데이트`;
    const body = [
      '## 보안 업데이트',
      '',
      '| 패키지 | 현재 | 수정 | 심각도 | CVE |',
      '|--------|------|------|--------|-----|',
      ...vulns.map(
        (v) => `| ${v.name} | ${v.currentVersion} | ${v.fixedVersion} | ${v.severity} | ${v.cve} |`,
      ),
      '',
      `**우선순위**: ${critical.length}개 critical/high 포함`,
    ].join('\n');

    return {
      branchName,
      title,
      body,
      changes: vulns.map((v) => ({
        file: 'package.json',
        from: `"${v.name}": "${v.currentVersion}"`,
        to: `"${v.name}": "${v.fixedVersion}"`,
      })),
    };
  }
}

// ============ MTU-N490: Release Notes AI ============

export interface CommitInfo {
  sha: string;
  type: 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore';
  scope?: string;
  subject: string;
  breaking: boolean;
}

export class ReleaseNotesGenerator {
  parse(commitMessage: string, sha: string): CommitInfo | null {
    const match = commitMessage.match(/^(\w+)(\(([^)]+)\))?(!)?: (.+)/);
    if (!match) return null;
    const typeRaw = match[1];
    const typeMap: Record<string, CommitInfo['type']> = {
      feat: 'feat',
      fix: 'fix',
      refactor: 'refactor',
      docs: 'docs',
      test: 'test',
      chore: 'chore',
    };
    const type = typeRaw && typeMap[typeRaw] ? typeMap[typeRaw] : null;
    if (!type) return null;
    return {
      sha,
      type,
      scope: match[3],
      subject: match[5] ?? '',
      breaking: Boolean(match[4]),
    };
  }

  generate(version: string, commits: CommitInfo[]): string {
    const byType = {
      feat: commits.filter((c) => c.type === 'feat'),
      fix: commits.filter((c) => c.type === 'fix'),
      refactor: commits.filter((c) => c.type === 'refactor'),
      breaking: commits.filter((c) => c.breaking),
    };

    const lines: string[] = [];
    lines.push(`# ${version} — ${new Date().toISOString().slice(0, 10)}`);
    lines.push('');

    if (byType.breaking.length > 0) {
      lines.push('## 파괴적 변경');
      byType.breaking.forEach((c) => lines.push(`- ${c.subject}`));
      lines.push('');
    }
    if (byType.feat.length > 0) {
      lines.push('## 신규 기능');
      byType.feat.forEach((c) =>
        lines.push(`- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}`),
      );
      lines.push('');
    }
    if (byType.fix.length > 0) {
      lines.push('## 버그 수정');
      byType.fix.forEach((c) =>
        lines.push(`- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}`),
      );
      lines.push('');
    }
    if (byType.refactor.length > 0) {
      lines.push('## 리팩토링');
      byType.refactor.forEach((c) => lines.push(`- ${c.subject}`));
    }

    return lines.join('\n');
  }
}
