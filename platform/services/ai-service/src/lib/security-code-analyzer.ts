// 보안 코드 분석기 -- FR-ADV34.1, FR-ADV34.3
// Design Ref: SVC-AI-ADV-R34 DESIGN §1, §3
// Plan SC: SC-1 (CSAP D-12 + OWASP Top 10 자동 탐지)
// CSAP: D-12 보안 코딩, D-06 보안 감사

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 보안 이슈 심각도 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** 보안 이슈 카테고리 */
export type IssueCategory =
  | 'sql_injection'
  | 'xss'
  | 'hardcoded_secret'
  | 'unauthenticated_access'
  | 'unsafe_deserialization'
  | 'path_traversal'
  | 'insecure_random'
  | 'missing_input_validation'
  | 'information_disclosure'
  | 'complexity'
  | 'code_smell';

/** 보안 이슈 */
export interface SecurityIssue {
  id: string;
  ruleId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  message: string;
  filePath: string;
  line: number;
  column?: number;
  codeSnippet: string;
  suggestion?: string;
  csapRef?: string;
  owaspRef?: string;
}

/** 복잡도 지표 -- Design §3 */
export interface ComplexityMetrics {
  filePath: string;
  functionName: string;
  lineStart: number;
  lineEnd: number;
  cyclomaticComplexity: number;
  lineCount: number;
  nestingDepth: number;
  parameterCount: number;
  issues: string[];
}

/** 보안 분석 규칙 */
export interface SecurityRule {
  id: string;
  name: string;
  category: IssueCategory;
  severity: IssueSeverity;
  pattern: RegExp;
  message: string;
  suggestion: string;
  csapRef?: string;
  owaspRef?: string;
}

/** 분석기 설정 */
export interface SecurityAnalyzerConfig {
  /** 사용자 정의 규칙 */
  customRules?: SecurityRule[];
  /** 무시할 규칙 ID */
  ignoreRules?: string[];
  /** 최대 함수 줄 수 */
  maxFunctionLines: number;
  /** 최대 중첩 깊이 */
  maxNestingDepth: number;
  /** 최대 파라미터 수 */
  maxParameters: number;
  /** 최대 순환 복잡도 */
  maxCyclomaticComplexity: number;
}

// -- 기본 보안 규칙 (CSAP D-12 + OWASP Top 10) -- Design §1 ─────────────────

const DEFAULT_RULES: SecurityRule[] = [
  // SQL 주입 (OWASP A03)
  {
    id: 'SEC-001',
    name: 'SQL 문자열 결합',
    category: 'sql_injection',
    severity: 'critical',
    pattern: /(?:query|execute|raw)\s*\(\s*[`'"].*\$\{/,
    message: 'SQL 쿼리에 템플릿 리터럴 변수 삽입 감지 (SQL 주입 위험)',
    suggestion: '매개변수화 쿼리($1, $2) 또는 ORM 메서드를 사용하십시오',
    csapRef: 'D-12.3',
    owaspRef: 'A03:2021',
  },
  {
    id: 'SEC-002',
    name: 'SQL 문자열 연결',
    category: 'sql_injection',
    severity: 'critical',
    pattern: /(?:query|execute|raw)\s*\(\s*['"].*['"]\s*\+/,
    message: 'SQL 쿼리 문자열 연결 감지 (SQL 주입 위험)',
    suggestion: '매개변수화 쿼리를 사용하십시오',
    csapRef: 'D-12.3',
    owaspRef: 'A03:2021',
  },
  // XSS (OWASP A07)
  {
    id: 'SEC-003',
    name: 'innerHTML 직접 할당',
    category: 'xss',
    severity: 'high',
    pattern: /\.innerHTML\s*=\s*(?!['"]<\/)/,
    message: 'innerHTML 직접 할당 감지 (XSS 위험)',
    suggestion: 'textContent를 사용하거나 DOMPurify.sanitize()로 정화하십시오',
    csapRef: 'D-12.5',
    owaspRef: 'A07:2021',
  },
  {
    id: 'SEC-004',
    name: 'dangerouslySetInnerHTML',
    category: 'xss',
    severity: 'high',
    pattern: /dangerouslySetInnerHTML/,
    message: 'dangerouslySetInnerHTML 사용 감지 (XSS 위험)',
    suggestion: 'DOMPurify로 정화 후 사용하거나 안전한 대안을 사용하십시오',
    owaspRef: 'A07:2021',
  },
  // 하드코딩 시크릿 (OWASP A02)
  {
    id: 'SEC-005',
    name: '하드코딩된 API 키',
    category: 'hardcoded_secret',
    severity: 'critical',
    pattern: /(?:api[_-]?key|apikey|secret|token|password)\s*[:=]\s*['"]\w{8,}/i,
    message: '하드코딩된 시크릿 값 감지',
    suggestion: '환경 변수(process.env)를 사용하십시오',
    csapRef: 'D-09.2',
    owaspRef: 'A02:2021',
  },
  {
    id: 'SEC-006',
    name: '하드코딩된 AWS 키',
    category: 'hardcoded_secret',
    severity: 'critical',
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/,
    message: 'AWS 접근 키 하드코딩 감지',
    suggestion: '환경 변수 또는 시크릿 매니저를 사용하십시오',
    owaspRef: 'A02:2021',
  },
  // 미인증 접근 (OWASP A01)
  {
    id: 'SEC-007',
    name: '인증 없는 API 핸들러',
    category: 'unauthenticated_access',
    severity: 'high',
    pattern: /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\(/,
    message: 'API 핸들러에 인증/권한 검사 부재 가능성',
    suggestion: 'verifyToken() + hasPermission() 검사를 추가하십시오',
    csapRef: 'D-08.1',
    owaspRef: 'A01:2021',
  },
  // 안전하지 않은 역직렬화 (OWASP A08)
  {
    id: 'SEC-008',
    name: 'eval 사용',
    category: 'unsafe_deserialization',
    severity: 'critical',
    pattern: /\beval\s*\(/,
    message: 'eval() 함수 사용 감지 (코드 주입 위험)',
    suggestion: 'JSON.parse() 또는 안전한 파서를 사용하십시오',
    owaspRef: 'A08:2021',
  },
  {
    id: 'SEC-009',
    name: 'Function 생성자',
    category: 'unsafe_deserialization',
    severity: 'high',
    pattern: /new\s+Function\s*\(/,
    message: 'Function 생성자 사용 감지 (코드 주입 위험)',
    suggestion: '사전 정의된 함수를 사용하십시오',
    owaspRef: 'A08:2021',
  },
  // 경로 순회 (OWASP A01)
  {
    id: 'SEC-010',
    name: '경로 순회 위험',
    category: 'path_traversal',
    severity: 'high',
    pattern: /(?:readFile|readdir|writeFile|createReadStream)\s*\(\s*(?:req\.(?:params|query|body)|`[^`]*\$\{)/,
    message: '사용자 입력이 파일 경로에 직접 사용 감지 (경로 순회 위험)',
    suggestion: 'path.resolve() + 화이트리스트 검증을 적용하십시오',
    csapRef: 'D-12.4',
    owaspRef: 'A01:2021',
  },
  // 안전하지 않은 난수
  {
    id: 'SEC-011',
    name: '안전하지 않은 난수',
    category: 'insecure_random',
    severity: 'medium',
    pattern: /Math\.random\s*\(\)/,
    message: 'Math.random() 사용 감지 (보안 목적 부적합)',
    suggestion: 'crypto.randomBytes() 또는 crypto.randomUUID()를 사용하십시오',
    csapRef: 'D-09.4',
  },
  // 정보 노출
  {
    id: 'SEC-012',
    name: '에러 스택 노출',
    category: 'information_disclosure',
    severity: 'medium',
    pattern: /(?:error|err)\.stack\b.*(?:res\.json|Response\.json|return)/,
    message: '에러 스택 트레이스 클라이언트 노출 위험',
    suggestion: '내부 에러 ID만 반환하고 스택은 서버 로그에만 기록하십시오',
    owaspRef: 'A05:2021',
  },
];

// -- 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SecurityAnalyzerConfig = {
  maxFunctionLines: 80,
  maxNestingDepth: 4,
  maxParameters: 5,
  maxCyclomaticComplexity: 15,
};

// -- SecurityCodeAnalyzer 메인 클래스 ─────────────────────────────────────────

/** 보안 코드 분석기 -- Design §1, §3 */
export class SecurityCodeAnalyzer {
  private readonly config: SecurityAnalyzerConfig;
  private readonly rules: SecurityRule[];

  constructor(config?: Partial<SecurityAnalyzerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [
      ...DEFAULT_RULES,
      ...(config?.customRules ?? []),
    ].filter((r) => !this.config.ignoreRules?.includes(r.id));
  }

  // -- 보안 규칙 분석 ────────────────────────────────────────────────────

  /** 코드 보안 분석 -- Design §1 */
  analyzeCode(code: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // 주석 건너뛰기
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const rule of this.rules) {
        if (rule.pattern.test(line)) {
          issues.push({
            id: `issue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            message: rule.message,
            filePath,
            line: i + 1,
            codeSnippet: line.trim(),
            suggestion: rule.suggestion,
            csapRef: rule.csapRef,
            owaspRef: rule.owaspRef,
          });
        }
      }
    }

    return issues;
  }

  // -- 복잡도 분석 ───────────────────────────────────────────────────────

  /** 코드 복잡도 분석 -- Design §3 */
  analyzeComplexity(code: string, filePath: string): ComplexityMetrics[] {
    const metrics: ComplexityMetrics[] = [];
    const lines = code.split('\n');

    // 함수 탐지 (간이 파서)
    const functionPattern = /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?|(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{)/;

    let currentFunc: { name: string; start: number; braceDepth: number } | null = null;
    let braceCount = 0;
    let maxNesting = 0;
    let complexity = 1;
    let paramCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      if (!currentFunc) {
        const match = line.match(functionPattern);
        if (match) {
          const name = match[1] ?? match[2] ?? match[3] ?? 'anonymous';
          currentFunc = { name, start: i + 1, braceDepth: 0 };
          complexity = 1;
          maxNesting = 0;
          braceCount = 0;

          // 파라미터 수 추정
          const paramMatch = line.match(/\(([^)]*)\)/);
          paramCount = paramMatch && paramMatch[1]?.trim()
            ? paramMatch[1].split(',').length
            : 0;
        }
      }

      if (currentFunc) {
        // 중괄호 추적
        for (const char of line) {
          if (char === '{') {
            braceCount++;
            maxNesting = Math.max(maxNesting, braceCount - currentFunc.braceDepth);
          } else if (char === '}') {
            braceCount--;
          }
        }

        // 순환 복잡도: 분기점 카운트
        if (/\b(?:if|else\s+if|case|for|while|do|catch|\?\?|&&|\|\||\?)\b/.test(line)) {
          complexity++;
        }

        // 함수 종료 감지
        if (braceCount <= 0 && i > currentFunc.start) {
          const lineCount = i + 1 - currentFunc.start;
          const issues: string[] = [];

          if (complexity > this.config.maxCyclomaticComplexity) {
            issues.push(`순환 복잡도 ${complexity} > ${this.config.maxCyclomaticComplexity}`);
          }
          if (lineCount > this.config.maxFunctionLines) {
            issues.push(`함수 줄 수 ${lineCount} > ${this.config.maxFunctionLines}`);
          }
          if (maxNesting > this.config.maxNestingDepth) {
            issues.push(`중첩 깊이 ${maxNesting} > ${this.config.maxNestingDepth}`);
          }
          if (paramCount > this.config.maxParameters) {
            issues.push(`파라미터 수 ${paramCount} > ${this.config.maxParameters}`);
          }

          metrics.push({
            filePath,
            functionName: currentFunc.name,
            lineStart: currentFunc.start,
            lineEnd: i + 1,
            cyclomaticComplexity: complexity,
            lineCount,
            nestingDepth: maxNesting,
            parameterCount: paramCount,
            issues,
          });

          currentFunc = null;
        }
      }
    }

    return metrics;
  }

  // -- 통합 분석 ─────────────────────────────────────────────────────────

  /** 보안 + 복잡도 통합 분석 */
  analyze(
    code: string,
    filePath: string,
  ): { security: SecurityIssue[]; complexity: ComplexityMetrics[] } {
    return {
      security: this.analyzeCode(code, filePath),
      complexity: this.analyzeComplexity(code, filePath),
    };
  }

  /** 규칙 목록 조회 */
  getRules(): SecurityRule[] {
    return [...this.rules];
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let analyzerInstance: SecurityCodeAnalyzer | null = null;

export function getSecurityCodeAnalyzer(
  config?: Partial<SecurityAnalyzerConfig>,
): SecurityCodeAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SecurityCodeAnalyzer(config);
  }
  return analyzerInstance;
}

export function resetSecurityCodeAnalyzer(): void {
  analyzerInstance = null;
}
