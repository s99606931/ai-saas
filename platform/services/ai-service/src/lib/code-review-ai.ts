// AI 코드 리뷰 Assistant -- FR-ADV34.2, FR-ADV34.4~34.6
// Design Ref: SVC-AI-ADV-R34 DESIGN §2, §4, §5, §6
// Plan SC: SC-2 (LLM 리뷰 정확도), SC-4 (리뷰 보고서)
// CSAP: D-12 보안 개발, D-06 리뷰 감사 로그

import {
  SecurityCodeAnalyzer,
  getSecurityCodeAnalyzer,
  type SecurityIssue,
  type ComplexityMetrics,
  type IssueSeverity,
} from './security-code-analyzer';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 리뷰 항목 */
export interface ReviewFinding {
  id: string;
  type: 'security' | 'quality' | 'performance' | 'suggestion';
  severity: IssueSeverity;
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd?: number;
  codeSnippet?: string;
  suggestion?: string;
  autoFixable: boolean;
  autoFix?: CodeFix;
}

/** 자동 수정 패치 -- Design §6 */
export interface CodeFix {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  originalCode: string;
  fixedCode: string;
  description: string;
}

/** 리뷰 보고서 -- Design §4 */
export interface ReviewReport {
  id: string;
  filePath: string;
  timestamp: string;
  findings: ReviewFinding[];
  summary: ReviewSummary;
  complexityMetrics: ComplexityMetrics[];
}

/** 보고서 요약 */
export interface ReviewSummary {
  totalFindings: number;
  bySeverity: Record<IssueSeverity, number>;
  byType: Record<string, number>;
  securityScore: number;
  qualityScore: number;
  autoFixableCount: number;
}

/** Git diff 청크 -- Design §5 */
export interface DiffChunk {
  filePath: string;
  additions: { line: number; content: string }[];
  deletions: { line: number; content: string }[];
}

/** 코드 리뷰 설정 */
export interface CodeReviewConfig {
  /** LLM 프로바이더 */
  llmProvider?: (prompt: string) => Promise<string>;
  /** 보안 분석기 */
  securityAnalyzer?: SecurityCodeAnalyzer;
  /** 자동 수정 활성화 */
  enableAutoFix: boolean;
  /** 최소 보고 심각도 */
  minSeverity: IssueSeverity;
}

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: CodeReviewConfig = {
  enableAutoFix: true,
  minSeverity: 'low',
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

// -- 자동 수정 패턴 -- Design §6 ─────────────────────────────────────────────

const AUTO_FIX_PATTERNS: {
  pattern: RegExp;
  replacement: (match: string) => string;
  description: string;
}[] = [
  {
    pattern: /console\.log\s*\(/g,
    replacement: () => 'logger.info(',
    description: 'console.log → logger.info 대체',
  },
  {
    pattern: /(?:const|let|var)\s+(\w*(?:key|secret|token|password)\w*)\s*=\s*['"][^'"]+['"]/gi,
    replacement: (match: string) => {
      const varMatch = match.match(/(?:const|let|var)\s+(\w+)/);
      const varName = varMatch?.[1] ?? 'SECRET';
      const envKey = varName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
      return `const ${varName} = process.env.${envKey}`;
    },
    description: '하드코딩 시크릿 → 환경 변수 참조',
  },
];

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'code-review-ai',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

function generateId(): string {
  return `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -- CodeReviewAI 메인 클래스 ─────────────────────────────────────────────────

/** AI 코드 리뷰 Assistant -- Design §2 */
export class CodeReviewAI {
  private readonly config: CodeReviewConfig;
  private readonly securityAnalyzer: SecurityCodeAnalyzer;

  constructor(config?: Partial<CodeReviewConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.securityAnalyzer = config?.securityAnalyzer ?? getSecurityCodeAnalyzer();
  }

  // -- 전체 리뷰 ─────────────────────────────────────────────────────────

  /** 코드 파일 전체 리뷰 -- Design §2, §4 */
  async reviewFile(code: string, filePath: string): Promise<ReviewReport> {
    const findings: ReviewFinding[] = [];

    // 1. 정적 보안 분석 (규칙 기반)
    const { security, complexity } = this.securityAnalyzer.analyze(code, filePath);

    // 보안 이슈 → 리뷰 항목 변환
    for (const issue of security) {
      findings.push(this.securityIssueToFinding(issue));
    }

    // 복잡도 이슈 → 리뷰 항목 변환
    for (const metric of complexity) {
      if (metric.issues.length > 0) {
        findings.push({
          id: generateId(),
          type: 'quality',
          severity: 'medium',
          title: `함수 "${metric.functionName}" 복잡도 초과`,
          description: metric.issues.join(', '),
          filePath,
          lineStart: metric.lineStart,
          lineEnd: metric.lineEnd,
          autoFixable: false,
        });
      }
    }

    // 2. LLM 심층 리뷰
    if (this.config.llmProvider) {
      const llmFindings = await this.llmReview(code, filePath);
      findings.push(...llmFindings);
    }

    // 3. 자동 수정 생성
    if (this.config.enableAutoFix) {
      this.generateAutoFixes(findings, code);
    }

    // 4. 심각도 필터
    const filtered = findings.filter(
      (f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[this.config.minSeverity],
    );

    // 5. 보고서 생성
    const report: ReviewReport = {
      id: generateId(),
      filePath,
      timestamp: new Date().toISOString(),
      findings: filtered,
      summary: this.generateSummary(filtered),
      complexityMetrics: complexity,
    };

    auditLog('review_completed', {
      filePath,
      totalFindings: filtered.length,
      securityScore: report.summary.securityScore,
    });

    return report;
  }

  // -- diff 기반 리뷰 -- Design §5 ──────────────────────────────────────

  /** Git diff 기반 변경 부분 리뷰 */
  async reviewDiff(
    diff: DiffChunk,
    fullCode: string,
  ): Promise<ReviewReport> {
    // 추가된 줄만 추출하여 분석
    const addedCode = diff.additions.map((a) => a.content).join('\n');

    const findings: ReviewFinding[] = [];

    // 보안 분석 (추가 코드만)
    const { security } = this.securityAnalyzer.analyze(addedCode, diff.filePath);
    for (const issue of security) {
      // 원본 줄 번호로 매핑
      const originalLine = diff.additions[issue.line - 1]?.line ?? issue.line;
      findings.push({
        ...this.securityIssueToFinding(issue),
        lineStart: originalLine,
      });
    }

    // LLM 리뷰 (컨텍스트 포함)
    if (this.config.llmProvider) {
      const llmFindings = await this.llmReviewDiff(diff, fullCode);
      findings.push(...llmFindings);
    }

    return {
      id: generateId(),
      filePath: diff.filePath,
      timestamp: new Date().toISOString(),
      findings,
      summary: this.generateSummary(findings),
      complexityMetrics: [],
    };
  }

  // -- LLM 리뷰 ─────────────────────────────────────────────────────────

  /** LLM 심층 리뷰 -- Design §2 */
  private async llmReview(code: string, filePath: string): Promise<ReviewFinding[]> {
    if (!this.config.llmProvider) return [];

    // 코드 내 시크릿 마스킹 (안전한 LLM 전송)
    const maskedCode = this.maskSecrets(code);

    const prompt = [
      '다음 TypeScript 코드를 리뷰하십시오. 공공기관 보안 코딩 기준(CSAP D-12) 관점에서 분석합니다.',
      '',
      '## 분석 관점',
      '1. 로직 오류 또는 엣지 케이스 미처리',
      '2. 보안 취약점 (인증, 권한, 입력 검증)',
      '3. 성능 문제 (불필요한 반복, 메모리 누수)',
      '4. 코드 품질 개선 제안',
      '',
      `## 파일: ${filePath}`,
      '```typescript',
      maskedCode.slice(0, 3000), // 컨텍스트 제한
      '```',
      '',
      '## 응답 형식 (JSON 배열)',
      '[{"type":"security|quality|performance|suggestion","severity":"critical|high|medium|low","title":"제목","description":"설명","line":줄번호,"suggestion":"수정 제안"}]',
    ].join('\n');

    try {
      const response = await this.config.llmProvider(prompt);
      return this.parseLlmResponse(response, filePath);
    } catch {
      return [];
    }
  }

  /** LLM diff 리뷰 */
  private async llmReviewDiff(
    diff: DiffChunk,
    _fullCode: string,
  ): Promise<ReviewFinding[]> {
    if (!this.config.llmProvider) return [];

    const addedLines = diff.additions
      .map((a) => `+${a.line}: ${a.content}`)
      .join('\n');

    const prompt = [
      '다음 코드 변경사항을 리뷰하십시오.',
      '',
      `## 파일: ${diff.filePath}`,
      '## 추가된 코드:',
      addedLines.slice(0, 2000),
      '',
      '## 응답 형식 (JSON 배열)',
      '[{"type":"security|quality|performance|suggestion","severity":"critical|high|medium|low","title":"제목","description":"설명","line":줄번호,"suggestion":"수정 제안"}]',
    ].join('\n');

    try {
      const response = await this.config.llmProvider(prompt);
      return this.parseLlmResponse(response, diff.filePath);
    } catch {
      return [];
    }
  }

  /** LLM 응답 파싱 */
  private parseLlmResponse(response: string, filePath: string): ReviewFinding[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as {
        type?: string;
        severity?: string;
        title?: string;
        description?: string;
        line?: number;
        suggestion?: string;
      }[];

      return parsed.map((item) => ({
        id: generateId(),
        type: (item.type as ReviewFinding['type']) ?? 'suggestion',
        severity: (item.severity as IssueSeverity) ?? 'low',
        title: item.title ?? 'LLM 분석 결과',
        description: item.description ?? '',
        filePath,
        lineStart: item.line ?? 0,
        suggestion: item.suggestion,
        autoFixable: false,
      }));
    } catch {
      return [];
    }
  }

  // -- 유틸 ──────────────────────────────────────────────────────────────

  /** 시크릿 마스킹 */
  private maskSecrets(code: string): string {
    return code
      .replace(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]+['"]/gi, '$&'.replace(/['"][^'"]+['"]/, '"***MASKED***"'))
      .replace(/(?:AKIA|ASIA)[A-Z0-9]{16}/g, '***AWS_KEY_MASKED***');
  }

  /** 보안 이슈 → 리뷰 항목 변환 */
  private securityIssueToFinding(issue: SecurityIssue): ReviewFinding {
    return {
      id: issue.id,
      type: 'security',
      severity: issue.severity,
      title: `[${issue.ruleId}] ${issue.message}`,
      description: `${issue.message}${issue.csapRef ? ` (CSAP ${issue.csapRef})` : ''}${issue.owaspRef ? ` (${issue.owaspRef})` : ''}`,
      filePath: issue.filePath,
      lineStart: issue.line,
      codeSnippet: issue.codeSnippet,
      suggestion: issue.suggestion,
      autoFixable: false,
    };
  }

  /** 자동 수정 생성 -- Design §6 */
  private generateAutoFixes(findings: ReviewFinding[], code: string): void {
    const lines = code.split('\n');

    for (const finding of findings) {
      if (finding.lineStart <= 0 || finding.lineStart > lines.length) continue;

      const line = lines[finding.lineStart - 1] ?? '';

      for (const fixPattern of AUTO_FIX_PATTERNS) {
        if (fixPattern.pattern.test(line)) {
          const fixedLine = line.replace(fixPattern.pattern, fixPattern.replacement);
          finding.autoFixable = true;
          finding.autoFix = {
            filePath: finding.filePath,
            lineStart: finding.lineStart,
            lineEnd: finding.lineStart,
            originalCode: line,
            fixedCode: fixedLine,
            description: fixPattern.description,
          };
          break;
        }
      }
    }
  }

  /** 보고서 요약 생성 -- Design §4 */
  private generateSummary(findings: ReviewFinding[]): ReviewSummary {
    const bySeverity: Record<IssueSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    const byType: Record<string, number> = {};

    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      byType[f.type] = (byType[f.type] ?? 0) + 1;
    }

    // 보안 점수: 100 - (critical*25 + high*10 + medium*3 + low*1)
    const securityDeduction =
      bySeverity.critical * 25 +
      bySeverity.high * 10 +
      bySeverity.medium * 3 +
      bySeverity.low * 1;
    const securityScore = Math.max(0, 100 - securityDeduction);

    // 품질 점수
    const qualityIssues = (byType['quality'] ?? 0) + (byType['performance'] ?? 0);
    const qualityScore = Math.max(0, 100 - qualityIssues * 5);

    return {
      totalFindings: findings.length,
      bySeverity,
      byType,
      securityScore,
      qualityScore,
      autoFixableCount: findings.filter((f) => f.autoFixable).length,
    };
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let reviewInstance: CodeReviewAI | null = null;

export function getCodeReviewAI(
  config?: Partial<CodeReviewConfig>,
): CodeReviewAI {
  if (!reviewInstance) {
    reviewInstance = new CodeReviewAI(config);
  }
  return reviewInstance;
}

export function resetCodeReviewAI(): void {
  reviewInstance = null;
}
