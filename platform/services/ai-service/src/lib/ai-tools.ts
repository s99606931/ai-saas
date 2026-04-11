// AI 도구 레지스트리 — FR-AI26.2 에이전트
// Design Ref: SVC-AI-2026 DESIGN §2
// ReAct 패턴 에이전트가 사용할 내장 도구 정의

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolCallResult {
  success: boolean;
  output: string;
  error?: string;
}

export type ToolExecutor = (params: Record<string, unknown>) => Promise<ToolCallResult>;

/**
 * 도구 레지스트리 — 에이전트가 호출 가능한 도구 목록
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_knowledge',
    description: '테넌트의 지식베이스(공공문서 등)에서 관련 정보를 시맨틱 검색합니다',
    parameters: {
      query: { type: 'string', description: '검색 질문', required: true },
      tenantId: { type: 'string', description: '테넌트 ID', required: true },
    },
  },
  {
    name: 'summarize_text',
    description: '긴 텍스트를 3줄로 요약합니다',
    parameters: {
      text: { type: 'string', description: '요약할 텍스트', required: true },
      style: { type: 'string', description: '요약 스타일: formal|bullet|brief', required: false },
    },
  },
  {
    name: 'classify_request',
    description: '민원/요청을 카테고리와 우선순위로 분류합니다',
    parameters: {
      text: { type: 'string', description: '분류할 민원 텍스트', required: true },
    },
  },
  {
    name: 'extract_entities',
    description: '텍스트에서 개체명(사람, 기관, 날짜, 금액, 주소)을 추출합니다',
    parameters: {
      text: { type: 'string', description: '분석할 텍스트', required: true },
    },
  },
  {
    name: 'calculate',
    description: '수학 계산을 수행합니다 (예산 계산, 날짜 차이 등)',
    parameters: {
      expression: { type: 'string', description: '계산식 (JavaScript 안전 표현식)', required: true },
    },
  },
  {
    name: 'current_datetime',
    description: '현재 날짜와 시간을 반환합니다',
    parameters: {},
  },
  {
    name: 'format_document',
    description: '공공기관 공문서 표준 형식으로 텍스트를 포맷합니다',
    parameters: {
      content: { type: 'string', description: '문서 내용', required: true },
      docType: { type: 'string', description: '문서 유형: 공문|보고서|계획서', required: true },
      author: { type: 'string', description: '작성자', required: false },
    },
  },
];

/**
 * 도구 실행기 팩토리 (각 도구의 실제 실행 로직)
 * RAG 검색은 의존성 주입으로 처리
 */
export function createToolExecutors(
  options: {
    ragSearch?: (query: string, tenantId: string) => Promise<string>;
    llmSummarize?: (text: string) => Promise<string>;
    llmClassify?: (text: string) => Promise<string>;
  } = {},
): Record<string, ToolExecutor> {
  return {
    search_knowledge: async (params): Promise<ToolCallResult> => {
      if (!options.ragSearch) {
        return { success: false, output: '', error: 'RAG 검색이 설정되지 않았습니다' };
      }
      const query = String(params['query'] ?? '');
      const tenantId = String(params['tenantId'] ?? '');
      if (!query || !tenantId) return { success: false, output: '', error: '쿼리와 테넌트 ID가 필요합니다' };
      const result = await options.ragSearch(query, tenantId);
      return { success: true, output: result };
    },

    summarize_text: async (params): Promise<ToolCallResult> => {
      const text = String(params['text'] ?? '').slice(0, 50000);
      if (options.llmSummarize) {
        const summary = await options.llmSummarize(text);
        return { success: true, output: summary };
      }
      // 폴백: 첫 3문장 추출
      const sentences = text.split(/[.!?。]\s+/).slice(0, 3).join('. ');
      return { success: true, output: `[요약]\n${sentences}` };
    },

    classify_request: async (params): Promise<ToolCallResult> => {
      const text = String(params['text'] ?? '');
      if (options.llmClassify) {
        const result = await options.llmClassify(text);
        return { success: true, output: result };
      }
      // 폴백: 키워드 기반 분류
      const category = detectCategory(text);
      return { success: true, output: JSON.stringify({ category, priority: '보통', requiresHuman: true }) };
    },

    extract_entities: async (params): Promise<ToolCallResult> => {
      const text = String(params['text'] ?? '');
      const entities = extractSimpleEntities(text);
      return { success: true, output: JSON.stringify(entities) };
    },

    calculate: async (params): Promise<ToolCallResult> => {
      const expression = String(params['expression'] ?? '');
      // CSAP D-12: 안전한 수학 표현식만 허용 (Function 생성자/eval 사용 금지)
      if (!/^[\d\s+\-*/().,]+$/.test(expression)) {
        return { success: false, output: '', error: '허용되지 않는 계산식입니다. 숫자와 사칙연산만 가능합니다.' };
      }
      try {
        const result = safeEvaluate(expression);
        if (result === null) {
          return { success: false, output: '', error: '계산 실패: 유효하지 않은 수식입니다' };
        }
        return { success: true, output: String(result) };
      } catch {
        return { success: false, output: '', error: '계산 실패' };
      }
    },

    current_datetime: async (): Promise<ToolCallResult> => {
      const now = new Date();
      const kst = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'short',
      }).format(now);
      return { success: true, output: kst };
    },

    format_document: async (params): Promise<ToolCallResult> => {
      const content = String(params['content'] ?? '');
      const docType = String(params['docType'] ?? '공문');
      const author = String(params['author'] ?? '');
      const now = new Date().toLocaleDateString('ko-KR');
      const formatted = `[${docType}]
작성일: ${now}${author ? `\n작성자: ${author}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
본 문서는 AI 초안입니다. 최종 검토 후 사용하세요.`;
      return { success: true, output: formatted };
    },
  };
}

function detectCategory(text: string): string {
  const patterns: Array<[RegExp, string]> = [
    [/교통|도로|주차|버스|지하철/, '교통'],
    [/복지|수당|지원금|기초생활/, '복지'],
    [/세금|납부|부과|환급/, '세금'],
    [/환경|쓰레기|분리수거|미세먼지/, '환경'],
  ];
  for (const [pattern, category] of patterns) {
    if (pattern.test(text)) return category;
  }
  return '민원';
}

function extractSimpleEntities(text: string): Record<string, string[]> {
  return {
    dates: [...new Set((text.match(/\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/g) ?? []))],
    amounts: [...new Set((text.match(/\d+,?\d*원|\d+만원|\d+억원/g) ?? []))],
    organizations: [...new Set((text.match(/\w+부|\w+청|\w+원|\w+처|\w+청/g) ?? []))].slice(0, 5),
  };
}

/**
 * 안전한 수학 표현식 평가기 (CSAP D-12 준수)
 *
 * Function 생성자/eval 대신 재귀 하강 파서로 사칙연산 + 괄호를 평가합니다.
 * 코드 인젝션 위험 0%. OWASP A03:2021 Injection 방지.
 *
 * 지원 연산: +, -, *, /, 괄호, 소수점
 */
function safeEvaluate(expression: string): number | null {
  // 토큰화: 숫자, 연산자, 괄호
  const tokens: string[] = [];
  const cleaned = expression.replace(/,/g, '').replace(/\s+/g, '');

  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === undefined) break;

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let num = '';
      while (i < cleaned.length) {
        const c = cleaned[i];
        if (c === undefined) break;
        if ((c >= '0' && c <= '9') || c === '.') {
          num += c;
          i++;
        } else {
          break;
        }
      }
      tokens.push(num);
    } else if ('+-*/()'.includes(ch)) {
      tokens.push(ch);
      i++;
    } else {
      return null; // 허용되지 않는 문자
    }
  }

  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string {
    const token = tokens[pos];
    pos++;
    return token ?? '';
  }

  // expression = term (('+' | '-') term)*
  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;

    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  // term = factor (('*' | '/') factor)*
  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;

    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (right === null) return null;
      if (op === '/') {
        if (right === 0) return null; // 0 나누기 방지
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  // factor = '(' expression ')' | number | unary
  function parseFactor(): number | null {
    const token = peek();
    if (token === undefined) return null;

    // 단항 연산자 처리
    if (token === '-' || token === '+') {
      const op = consume();
      const factor = parseFactor();
      if (factor === null) return null;
      return op === '-' ? -factor : factor;
    }

    if (token === '(') {
      consume(); // '('
      const result = parseExpression();
      if (result === null || peek() !== ')') return null;
      consume(); // ')'
      return result;
    }

    // 숫자
    const num = parseFloat(consume());
    if (isNaN(num) || !isFinite(num)) return null;
    return num;
  }

  const result = parseExpression();
  if (result === null || pos !== tokens.length) return null;
  if (!isFinite(result)) return null;
  return result;
}
