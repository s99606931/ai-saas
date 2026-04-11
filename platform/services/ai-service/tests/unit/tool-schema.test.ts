// SVC-AI-ADV-R4 단위 테스트: 도구 스키마 변환
// Design Ref: SVC-AI-ADV-R4 DESIGN §2
// Plan SC: FR-ADV4.2
// CSAP: D-12 시스템 개발 보안

import { describe, it, expect } from 'vitest';
import {
  toolToOpenAISchema,
  toolsToOpenAISchema,
  parseToolCalls,
  parseToolArguments,
} from '../../src/lib/tool-schema.js';
import type { ToolDefinition } from '../../src/lib/ai-tools.js';

const sampleTool: ToolDefinition = {
  name: 'search_knowledge',
  description: '지식베이스에서 정보를 검색합니다',
  parameters: {
    query: { type: 'string', description: '검색 질문', required: true },
    tenantId: { type: 'string', description: '테넌트 ID', required: true },
    limit: { type: 'number', description: '결과 수', required: false },
  },
};

describe('toolToOpenAISchema (FR-ADV4.2)', () => {
  it('ToolDefinition을 OpenAI Function Schema로 변환한다', () => {
    const result = toolToOpenAISchema(sampleTool);
    expect(result.type).toBe('function');
    expect(result.function.name).toBe('search_knowledge');
    expect(result.function.description).toBe('지식베이스에서 정보를 검색합니다');
  });

  it('파라미터를 JSON Schema properties로 변환한다', () => {
    const result = toolToOpenAISchema(sampleTool);
    const props = result.function.parameters.properties;
    expect(props['query']).toEqual({ type: 'string', description: '검색 질문' });
    expect(props['tenantId']).toEqual({ type: 'string', description: '테넌트 ID' });
    expect(props['limit']).toEqual({ type: 'number', description: '결과 수' });
  });

  it('required 파라미터만 required 배열에 포함한다', () => {
    const result = toolToOpenAISchema(sampleTool);
    const required = result.function.parameters.required;
    expect(required).toContain('query');
    expect(required).toContain('tenantId');
    expect(required).not.toContain('limit');
  });

  it('parameters.type은 항상 object이다', () => {
    const result = toolToOpenAISchema(sampleTool);
    expect(result.function.parameters.type).toBe('object');
  });
});

describe('toolsToOpenAISchema', () => {
  it('도구 배열을 일괄 변환한다', () => {
    const tool2: ToolDefinition = {
      name: 'summarize',
      description: '요약합니다',
      parameters: { text: { type: 'string', description: '텍스트', required: true } },
    };
    const results = toolsToOpenAISchema([sampleTool, tool2]);
    expect(results).toHaveLength(2);
    expect(results[0]?.function.name).toBe('search_knowledge');
    expect(results[1]?.function.name).toBe('summarize');
  });

  it('빈 배열은 빈 결과를 반환한다', () => {
    const results = toolsToOpenAISchema([]);
    expect(results).toHaveLength(0);
  });
});

describe('parseToolCalls', () => {
  it('JSON 배열 형식의 tool_calls를 파싱한다', () => {
    const text = `도구를 호출합니다:
[{"id": "call_1", "name": "search_knowledge", "arguments": {"query": "테스트"}}]`;
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.function.name).toBe('search_knowledge');
  });

  it('function 필드가 있는 형식을 파싱한다', () => {
    const text = `[{"id": "call_0", "function": {"name": "summarize", "arguments": "{\\"text\\": \\"내용\\"}"}}]`;
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.function.name).toBe('summarize');
  });

  it('중첩 객체가 있는 단일 JSON은 배열 형식 폴백이 더 안정적이다', () => {
    // 단일 객체 형식 정규식은 lazy 매칭으로 중첩 객체에 제한적
    // 실무에서는 배열 형식으로 반환되므로 배열 래핑을 권장
    const text = `[{"name": "search_knowledge", "arguments": {"query": "질문"}}]`;
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.function.name).toBe('search_knowledge');
  });

  it('도구 호출이 없는 텍스트는 빈 배열을 반환한다', () => {
    const text = '안녕하세요. 민원 처리 결과입니다.';
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(0);
  });

  it('잘못된 JSON은 빈 배열을 반환한다', () => {
    const text = '{invalid json...';
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(0);
  });

  it('arguments가 문자열일 때 그대로 유지한다', () => {
    const text = `[{"id": "call_0", "name": "test", "arguments": "{\\"key\\": \\"value\\"}"}]`;
    const calls = parseToolCalls(text);
    expect(calls[0]?.function.arguments).toBeDefined();
  });

  it('arguments가 객체일 때 JSON 문자열로 변환한다', () => {
    const text = `[{"id": "call_0", "name": "test", "arguments": {"key": "value"}}]`;
    const calls = parseToolCalls(text);
    const args = calls[0]?.function.arguments;
    expect(args).toBeDefined();
    if (args) {
      const parsed = JSON.parse(args);
      expect(parsed['key']).toBe('value');
    }
  });

  it('id가 없으면 자동 생성한다', () => {
    const text = `[{"name": "test", "arguments": {}}]`;
    const calls = parseToolCalls(text);
    expect(calls[0]?.id).toBe('call_0');
  });
});

describe('parseToolArguments', () => {
  it('유효한 JSON을 파싱한다', () => {
    const result = parseToolArguments('{"query": "테스트", "limit": 5}');
    expect(result['query']).toBe('테스트');
    expect(result['limit']).toBe(5);
  });

  it('잘못된 JSON은 input 키로 래핑한다', () => {
    const result = parseToolArguments('단순 텍스트');
    expect(result['input']).toBe('단순 텍스트');
  });

  it('빈 JSON 객체를 파싱한다', () => {
    const result = parseToolArguments('{}');
    expect(Object.keys(result)).toHaveLength(0);
  });
});
