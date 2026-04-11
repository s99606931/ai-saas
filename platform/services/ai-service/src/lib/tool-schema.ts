// 도구 스키마 변환: ToolDefinition -> OpenAI Function Schema -- FR-ADV4.2
// Design Ref: SVC-AI-ADV-R4 DESIGN §2
// 기존 ToolDefinition을 OpenAI 호환 JSON Schema로 변환
// CSAP: D-12 시스템 개발 보안

import type { ToolDefinition } from './ai-tools.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface JSONSchemaProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
}

export interface OpenAIFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 문자열
  };
}

export interface ToolCallLog {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: string;
  success: boolean;
  durationMs: number;
}

// ── 스키마 변환 ──────────────────────────────────────────────────────────

/**
 * ToolDefinition -> OpenAI Function Schema 변환
 * Plan SC: FR-ADV4.2
 */
export function toolToOpenAISchema(tool: ToolDefinition): OpenAIFunctionTool {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
    properties[paramName] = {
      type: paramDef.type,
      description: paramDef.description,
    };
    if (paramDef.required) {
      required.push(paramName);
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

/**
 * ToolDefinition 배열 -> OpenAI Function Schema 배열 변환
 * Plan SC: FR-ADV4.2
 */
export function toolsToOpenAISchema(tools: ToolDefinition[]): OpenAIFunctionTool[] {
  return tools.map(toolToOpenAISchema);
}

/**
 * LLM 응답에서 tool_calls 추출
 * OpenAI 호환 형식 또는 텍스트 기반 파싱
 */
export function parseToolCalls(responseText: string): ToolCallRequest[] {
  // JSON 배열 형식 시도
  const jsonMatch = /\[[\s\S]*?\]/.exec(responseText);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
      return parsed
        .filter((item) => item['function'] || item['name'])
        .map((item, idx) => {
          const fn = (item['function'] as Record<string, unknown>) ?? item;
          return {
            id: String(item['id'] ?? `call_${idx}`),
            type: 'function' as const,
            function: {
              name: String(fn['name'] ?? ''),
              arguments: typeof fn['arguments'] === 'string'
                ? fn['arguments']
                : JSON.stringify(fn['arguments'] ?? {}),
            },
          };
        })
        .filter((tc) => tc.function.name.length > 0);
    } catch {
      // 파싱 실패 시 계속
    }
  }

  // 단일 JSON 객체 형식 시도
  const objMatch = /\{[\s\S]*?"(?:function|name)"[\s\S]*?\}/.exec(responseText);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]) as Record<string, unknown>;
      const fn = (parsed['function'] as Record<string, unknown>) ?? parsed;
      const name = String(fn['name'] ?? '');
      if (name) {
        return [{
          id: String(parsed['id'] ?? 'call_0'),
          type: 'function' as const,
          function: {
            name,
            arguments: typeof fn['arguments'] === 'string'
              ? fn['arguments']
              : JSON.stringify(fn['arguments'] ?? {}),
          },
        }];
      }
    } catch {
      // 파싱 실패
    }
  }

  return [];
}

/**
 * tool_call의 arguments를 안전하게 파싱
 */
export function parseToolArguments(argsStr: string): Record<string, unknown> {
  try {
    return JSON.parse(argsStr) as Record<string, unknown>;
  } catch {
    return { input: argsStr };
  }
}
