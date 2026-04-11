// SVC-AI-2026 단위 테스트: AI 도구 레지스트리
// Design Ref: SVC-AI-2026 DESIGN §2
// Plan SC: FR-AI26.2
// CSAP: D-12 시스템 개발 보안 (안전한 수식 평가)

import { describe, it, expect } from 'vitest';

import {
  TOOL_DEFINITIONS,
  createToolExecutors,
} from '../../src/lib/ai-tools.js';

// ── TOOL_DEFINITIONS 상수 ─────────────────────────────────────────────────

describe('TOOL_DEFINITIONS 도구 정의', () => {
  it('7개 도구가 정의되어 있다', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(7);
  });

  it('모든 도구에 필수 필드가 있다', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    }
  });

  it('search_knowledge 도구가 정의되어 있다', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'search_knowledge');
    expect(tool).toBeDefined();
    expect(tool!.parameters['query']!.required).toBe(true);
    expect(tool!.parameters['tenantId']!.required).toBe(true);
  });

  it('calculate 도구가 정의되어 있다', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'calculate');
    expect(tool).toBeDefined();
  });
});

// ── createToolExecutors 도구 실행기 ─────────────────────────────────────

describe('createToolExecutors 도구 실행기', () => {
  it('7개 실행기가 생성된다', () => {
    const executors = createToolExecutors();
    expect(Object.keys(executors)).toHaveLength(7);
  });

  describe('search_knowledge', () => {
    it('ragSearch 없으면 실패한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['search_knowledge']!({ query: '질문', tenantId: 't1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('설정되지 않았습니다');
    });

    it('ragSearch가 있으면 검색한다', async () => {
      const executors = createToolExecutors({
        ragSearch: async (query, tenantId) => `결과: ${query} (${tenantId})`,
      });
      const result = await executors['search_knowledge']!({ query: '전자정부법', tenantId: 't1' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('전자정부법');
    });

    it('query 누락 시 실패한다', async () => {
      const executors = createToolExecutors({
        ragSearch: async () => '결과',
      });
      const result = await executors['search_knowledge']!({ tenantId: 't1' });
      expect(result.success).toBe(false);
    });
  });

  describe('summarize_text', () => {
    it('LLM 없이 폴백 요약한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['summarize_text']!({
        text: '첫째 문장입니다. 둘째 문장입니다. 셋째 문장입니다. 넷째 문장입니다.',
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('요약');
    });

    it('llmSummarize가 있으면 LLM으로 요약한다', async () => {
      const executors = createToolExecutors({
        llmSummarize: async (text) => `LLM 요약: ${text.slice(0, 20)}`,
      });
      const result = await executors['summarize_text']!({ text: '긴 텍스트 내용' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('LLM 요약');
    });
  });

  describe('classify_request', () => {
    it('교통 키워드를 교통으로 분류한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['classify_request']!({ text: '버스 노선 변경 민원' });
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output);
      expect(parsed.category).toBe('교통');
    });

    it('복지 키워드를 복지로 분류한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['classify_request']!({ text: '기초생활 수당 신청' });
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output);
      expect(parsed.category).toBe('복지');
    });

    it('매칭 안 되면 민원으로 분류한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['classify_request']!({ text: '일반 문의' });
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output);
      expect(parsed.category).toBe('민원');
    });

    it('llmClassify가 있으면 LLM으로 분류한다', async () => {
      const executors = createToolExecutors({
        llmClassify: async () => JSON.stringify({ category: '세금', priority: '높음' }),
      });
      const result = await executors['classify_request']!({ text: '세금 관련' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('세금');
    });
  });

  describe('extract_entities', () => {
    it('날짜를 추출한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['extract_entities']!({ text: '2026-04-11 회의' });
      expect(result.success).toBe(true);
      const entities = JSON.parse(result.output);
      expect(entities.dates).toContain('2026-04-11');
    });

    it('금액을 추출한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['extract_entities']!({ text: '예산 500만원 배정' });
      expect(result.success).toBe(true);
      const entities = JSON.parse(result.output);
      expect(entities.amounts.length).toBeGreaterThan(0);
    });
  });

  describe('calculate (CSAP D-12 안전 평가)', () => {
    it('기본 사칙연산을 수행한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: '2 + 3' });
      expect(result.success).toBe(true);
      expect(result.output).toBe('5');
    });

    it('복잡한 수식을 처리한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: '(10 + 5) * 2 / 3' });
      expect(result.success).toBe(true);
      expect(Number(result.output)).toBeCloseTo(10);
    });

    it('코드 인젝션을 차단한다 (CSAP D-12)', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: 'process.exit(1)' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('허용되지 않는');
    });

    it('eval 인젝션을 차단한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: 'eval("alert(1)")' });
      expect(result.success).toBe(false);
    });

    it('0으로 나누기를 처리한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: '10 / 0' });
      expect(result.success).toBe(false);
    });

    it('괄호 연산을 처리한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: '(1 + 2) * (3 + 4)' });
      expect(result.success).toBe(true);
      expect(result.output).toBe('21');
    });

    it('소수점 계산을 처리한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['calculate']!({ expression: '3.14 * 2' });
      expect(result.success).toBe(true);
      expect(Number(result.output)).toBeCloseTo(6.28);
    });
  });

  describe('current_datetime', () => {
    it('현재 날짜/시간을 반환한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['current_datetime']!({});
      expect(result.success).toBe(true);
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('format_document', () => {
    it('공문서 형식으로 포맷한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['format_document']!({
        content: '전자정부 서비스 제공 안내',
        docType: '공문',
        author: '행정관',
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('공문');
      expect(result.output).toContain('행정관');
      expect(result.output).toContain('AI 초안');
    });

    it('author 없이도 생성한다', async () => {
      const executors = createToolExecutors();
      const result = await executors['format_document']!({
        content: '내용',
        docType: '보고서',
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('보고서');
    });
  });
});
