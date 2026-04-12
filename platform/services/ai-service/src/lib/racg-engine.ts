// SVC-AI-ADV-R44: RACG (검색 증강 코드 생성) 엔진
// Design Ref: §흐름, §공공기관 코딩 표준
// Plan SC: FR-R44.2, FR-R44.3

import { CodeContextRetriever, type CodeSnippet } from './code-context-retriever'

export interface RACGOptions {
  k?: number                      // 검색 컨텍스트 개수
  language?: 'typescript' | 'python' | 'go' | 'javascript'
  frId?: string                   // Plan SC 주석에 기록할 FR ID
  enforceStandards?: boolean      // 코딩 표준 강제 적용
}

export interface GeneratedCode {
  code: string
  language: string
  contextsUsed: CodeSnippet[]
  standardsApplied: string[]
  warnings: string[]
}

type LocalCodeLLM = (prompt: string) => Promise<string>

/**
 * 공공기관 코딩 표준 체크리스트.
 */
const CODING_STANDARDS = {
  typescript: [
    '2-space indent',
    'function body ≤ 80 lines',
    'file ≤ 800 lines',
    'no hardcoded secrets',
    '// Plan SC: FR-XX.X 주석 필수',
    '한국어 WHY 주석 권장',
  ],
  python: [
    '4-space indent',
    'snake_case 변수/함수',
    'PascalCase 클래스',
    'no hardcoded secrets',
    'docstring 필수',
  ],
  go: ['gofmt', 'camelCase', 'no hardcoded secrets'],
  javascript: ['2-space indent', 'no hardcoded secrets', 'use const/let'],
}

/**
 * RACG 엔진 — 검색 + 로컬 LLM + 표준 강제.
 */
export class RACGEngine {
  private readonly retriever: CodeContextRetriever
  private readonly llm: LocalCodeLLM

  constructor(options: {
    retriever?: CodeContextRetriever
    llm: LocalCodeLLM
  }) {
    this.retriever = options.retriever ?? new CodeContextRetriever()
    this.llm = options.llm
  }

  /**
   * 쿼리 → 생성된 코드.
   */
  async generate(query: string, opts: RACGOptions = {}): Promise<GeneratedCode> {
    if (!query || query.trim().length === 0) {
      throw new Error('query required')
    }

    const language = opts.language ?? 'typescript'
    const k = opts.k ?? 5
    const enforce = opts.enforceStandards !== false

    // 1) 관련 코드 검색
    const contexts = this.retriever.search(query, k)

    // 2) 프롬프트 조립
    const prompt = this.buildPrompt(query, contexts, language, opts.frId, enforce)

    // 3) 로컬 LLM 호출
    const raw = await this.llm(prompt)

    // 4) 후처리 + 표준 검증
    const { code, warnings, standardsApplied } = this.postProcess(raw, language, opts.frId)

    return {
      code,
      language,
      contextsUsed: contexts,
      standardsApplied,
      warnings,
    }
  }

  /**
   * 검색기 접근자 (파일 인덱싱용).
   */
  getRetriever(): CodeContextRetriever {
    return this.retriever
  }

  private buildPrompt(
    query: string,
    contexts: CodeSnippet[],
    language: string,
    frId: string | undefined,
    enforce: boolean,
  ): string {
    const contextBlock = contexts
      .map((c, i) => `--- 참조 ${i + 1}: ${c.path} ---\n${c.content}`)
      .join('\n\n')

    const standards = (CODING_STANDARDS[language as keyof typeof CODING_STANDARDS] ?? [])
      .map((s) => `  - ${s}`)
      .join('\n')

    const frComment = frId ? `// Plan SC: ${frId}` : ''

    return [
      `당신은 공공기관 SaaS 프레임워크 개발자다. ${language} 코드를 생성하라.`,
      '',
      `요구사항: ${query}`,
      '',
      contexts.length > 0 ? `다음은 기존 코드베이스의 관련 참조다:\n${contextBlock}` : '',
      '',
      enforce ? `다음 공공기관 코딩 표준을 반드시 준수하라:\n${standards}` : '',
      '',
      frId ? `생성 코드 상단에 ${frComment} 주석을 포함하라.` : '',
      '',
      '생성 코드:',
    ]
      .filter(Boolean)
      .join('\n')
  }

  private postProcess(
    raw: string,
    language: string,
    frId?: string,
  ): { code: string; warnings: string[]; standardsApplied: string[] } {
    const warnings: string[] = []
    const standardsApplied: string[] = []
    let code = raw.trim()

    // 하드코딩 시크릿 검사
    const secretPatterns = [
      /api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/i,
      /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /AKIA[0-9A-Z]{16}/,
    ]
    for (const p of secretPatterns) {
      if (p.test(code)) {
        throw new Error('BLOCKED: 생성 코드에 하드코딩 시크릿 감지 (CSAP D-12)')
      }
    }
    standardsApplied.push('no-hardcoded-secrets')

    // FR ID 주석 자동 삽입
    if (frId && !code.includes(frId)) {
      code = `// Plan SC: ${frId}\n${code}`
      standardsApplied.push('fr-id-comment')
    }

    // 탭 → 스페이스 (TypeScript)
    if (language === 'typescript' && code.includes('\t')) {
      code = code.replace(/\t/g, '  ')
      standardsApplied.push('2-space-indent')
    }

    // 파일 길이 경고
    const lineCount = code.split('\n').length
    if (lineCount > 800) {
      warnings.push(`생성 코드가 800줄 초과 (${lineCount}줄). 분리 검토 권장.`)
    }

    // 함수 길이 체크 (간이)
    const longFunction = /(?:function|=>)\s*\{[\s\S]{3000,}\}/
    if (longFunction.test(code)) {
      warnings.push('함수 본문 과대 가능성 (80줄 초과 의심)')
    }

    return { code, warnings, standardsApplied }
  }
}

export function createRACGEngine(options: { retriever?: CodeContextRetriever; llm: LocalCodeLLM }): RACGEngine {
  return new RACGEngine(options)
}
