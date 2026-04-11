// MCP (Model Context Protocol) 서버 코어 — FR-ADV7.1, FR-ADV7.4, FR-ADV7.5, FR-ADV7.7, FR-ADV7.8
// Design Ref: SVC-AI-ADV-R7 DESIGN §1, §4, §5, §7, §8
// Plan SC: SC-1~SC-6
// CSAP: D-08 접근 통제, D-06 감사 로깅, D-12 시스템 개발 보안
// N2SF: N-05 O등급 데이터만 처리

import { z } from 'zod';
import { logAiEvent } from './audit.js';
import { maskPII } from './pii-masking.js';

// ── JSON-RPC 2.0 타입 정의 ───────────────────────────────────────────────────

/** JSON-RPC 2.0 요청 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 응답 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JSONRPCError;
}

/** JSON-RPC 2.0 에러 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

// JSON-RPC 표준 에러 코드
const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;

// ── MCP 프로토콜 타입 ────────────────────────────────────────────────────────

/** MCP 서버 정보 */
export interface MCPServerInfo {
  name: string;
  version: string;
}

/** MCP 서버 기능 */
export interface MCPCapabilities {
  resources?: { subscribe: boolean; listChanged: boolean };
  tools?: { listChanged: boolean };
  prompts?: { listChanged: boolean };
}

/** MCP 리소스 정의 */
export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/** MCP 리소스 내용 */
export interface MCPResourceContent {
  uri: string;
  text: string;
  mimeType: string;
}

/** MCP 도구 정의 (외부 노출용) */
export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** MCP 도구 실행 결과 */
export interface MCPToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** MCP 프롬프트 정의 */
export interface MCPPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/** MCP 프롬프트 메시지 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

// ── 도구 컨텍스트 & 정의 ────────────────────────────────────────────────────

/** 도구 실행 컨텍스트 (RBAC 정보 포함) */
export interface ToolContext {
  userId: string;
  tenantId: string;
  roles: string[];
  requestId: string;
}

/** 도구 등록 정의 (내부용) — Design §3.2 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  requiredPermission: string;
  handler: (input: unknown, context: ToolContext) => Promise<MCPToolResult>;
}

// ── 리소스 프로바이더 인터페이스 ─────────────────────────────────────────────

/** 리소스 프로바이더 — Design §2.2 */
export interface MCPResourceProvider {
  list(): Promise<MCPResource[]>;
  read(uri: string): Promise<{ contents: MCPResourceContent[] }>;
}

// ── 프롬프트 프로바이더 인터페이스 ───────────────────────────────────────────

/** 프롬프트 프로바이더 — Design §4 */
export interface MCPPromptProvider {
  list(): Promise<MCPPrompt[]>;
  get(name: string, args: Record<string, string>): Promise<{ messages: MCPPromptMessage[] }>;
}

// ── MCP 서버 클래스 ──────────────────────────────────────────────────────────

/** 권한 검사 함수 */
export type MCPPermissionChecker = (context: ToolContext, permission: string) => boolean;

/** MCP 서버 설정 */
export interface MCPServerConfig {
  serverInfo: MCPServerInfo;
  permissionChecker: MCPPermissionChecker;
  resourceProvider?: MCPResourceProvider;
  promptProvider?: MCPPromptProvider;
}

/**
 * MCP (Model Context Protocol) 서버
 *
 * Anthropic MCP 2025-03-26 사양 기반으로 공공기관 도메인 도구를 AI 모델에 노출합니다.
 * JSON-RPC 2.0 전송 프로토콜을 사용하며, RBAC 권한 제어와 감사 로깅을 내장합니다.
 *
 * 주요 기능:
 * - Resources: 법령, 공문서 양식, 행정코드, CSAP 통제항목
 * - Tools: 법령 검색, 공문서 생성, 행정 DB 조회, CSAP 확인, 수수료 계산
 * - Prompts: 법령 분석, 공문서 작성, 준수 보고서 템플릿
 */
export class MCPServer {
  private readonly config: MCPServerConfig;
  private readonly tools: Map<string, MCPToolDefinition> = new Map();
  private _initialized = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /** MCP 초기화 완료 여부 */
  get isInitialized(): boolean {
    return this._initialized;
  }

  // ── 도구 동적 관리 — Design §7 ───────────────────────────────────

  /** 도구를 런타임에 등록합니다 */
  registerTool(definition: MCPToolDefinition): void {
    this.tools.set(definition.name, definition);
  }

  /** 도구를 런타임에 해제합니다 */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /** 등록된 도구 수 */
  get toolCount(): number {
    return this.tools.size;
  }

  // ── JSON-RPC 메시지 처리 — Design §1.2 ────────────────────────────

  /**
   * JSON-RPC 요청을 처리하고 응답을 반환합니다.
   *
   * @param raw - 원시 JSON 문자열 또는 파싱된 객체
   * @param context - 도구 실행 컨텍스트 (인증 정보)
   * @returns JSON-RPC 응답
   */
  async handleRequest(raw: string | Record<string, unknown>, context: ToolContext): Promise<JSONRPCResponse> {
    // JSON 파싱
    let request: JSONRPCRequest;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw;
      request = validateJSONRPCRequest(parsed);
    } catch {
      return createErrorResponse(0, JSONRPC_PARSE_ERROR, 'JSON 파싱 오류');
    }

    // 감사 로그: 요청 수신 — Design §8
    await logAiEvent(
      'MCP_REQUEST', context.userId, context.requestId, context.tenantId,
      'mcp-server', 'mcp-client',
      { method: request.method },
    );

    // 메서드 라우팅
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'resources/list':
          return await this.handleResourcesList(request);
        case 'resources/read':
          return await this.handleResourcesRead(request, context);
        case 'tools/list':
          return this.handleToolsList(request);
        case 'tools/call':
          return await this.handleToolsCall(request, context);
        case 'prompts/list':
          return await this.handlePromptsList(request);
        case 'prompts/get':
          return await this.handlePromptsGet(request, context);
        default:
          return createErrorResponse(request.id, JSONRPC_METHOD_NOT_FOUND, `알 수 없는 메서드: ${request.method}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '내부 서버 오류';
      return createErrorResponse(request.id, JSONRPC_INTERNAL_ERROR, message);
    }
  }

  // ── initialize — Design §1.3 ──────────────────────────────────────

  private handleInitialize(request: JSONRPCRequest): JSONRPCResponse {
    this._initialized = true;
    return createSuccessResponse(request.id, {
      protocolVersion: '2025-03-26',
      capabilities: {
        resources: { subscribe: false, listChanged: true },
        tools: { listChanged: true },
        prompts: { listChanged: true },
      } satisfies MCPCapabilities,
      serverInfo: this.config.serverInfo,
    });
  }

  // ── resources/list — Design §2 ────────────────────────────────────

  private async handleResourcesList(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this.config.resourceProvider) {
      return createSuccessResponse(request.id, { resources: [] });
    }
    const resources = await this.config.resourceProvider.list();
    return createSuccessResponse(request.id, { resources });
  }

  // ── resources/read — Design §2 ────────────────────────────────────

  private async handleResourcesRead(request: JSONRPCRequest, context: ToolContext): Promise<JSONRPCResponse> {
    if (!this.config.resourceProvider) {
      return createErrorResponse(request.id, JSONRPC_METHOD_NOT_FOUND, '리소스 프로바이더 미설정');
    }

    const uri = request.params?.['uri'];
    if (typeof uri !== 'string' || uri.length === 0) {
      return createErrorResponse(request.id, JSONRPC_INVALID_PARAMS, 'uri 파라미터가 필요합니다');
    }

    // 감사 로그: 리소스 접근 — Design §8
    await logAiEvent(
      'MCP_RESOURCE_READ', context.userId, context.requestId, context.tenantId,
      'mcp-server', 'mcp-client',
      { uri },
    );

    const result = await this.config.resourceProvider.read(uri);
    return createSuccessResponse(request.id, result);
  }

  // ── tools/list — Design §3 ────────────────────────────────────────

  private handleToolsList(request: JSONRPCRequest): JSONRPCResponse {
    const toolInfos: MCPToolInfo[] = [];
    for (const tool of this.tools.values()) {
      toolInfos.push({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJSONSchema(tool.inputSchema),
      });
    }
    return createSuccessResponse(request.id, { tools: toolInfos });
  }

  // ── tools/call — Design §3, §5, §6 ────────────────────────────────

  private async handleToolsCall(request: JSONRPCRequest, context: ToolContext): Promise<JSONRPCResponse> {
    const toolName = request.params?.['name'];
    if (typeof toolName !== 'string') {
      return createErrorResponse(request.id, JSONRPC_INVALID_PARAMS, 'name 파라미터가 필요합니다');
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return createErrorResponse(request.id, JSONRPC_METHOD_NOT_FOUND, `도구를 찾을 수 없습니다: ${toolName}`);
    }

    // RBAC 권한 확인 — Design §5
    if (!this.config.permissionChecker(context, tool.requiredPermission)) {
      await logAiEvent(
        'MCP_TOOL_PERMISSION_DENIED', context.userId, context.requestId, context.tenantId,
        'mcp-server', 'mcp-client',
        { requiredPermission: tool.requiredPermission, toolName },
      );
      return createErrorResponse(request.id, JSONRPC_INTERNAL_ERROR, `권한이 없습니다: ${tool.requiredPermission}`);
    }

    // 입력 검증 — Design §6, CSAP D-12
    const rawArguments = request.params?.['arguments'] ?? {};
    let validatedInput: unknown;
    try {
      validatedInput = tool.inputSchema.parse(rawArguments);
    } catch (error: unknown) {
      const message = error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        : '입력 검증 실패';
      return createErrorResponse(request.id, JSONRPC_INVALID_PARAMS, message);
    }

    // 도구 실행
    const startTime = Date.now();
    const result = await tool.handler(validatedInput, context);
    const durationMs = Date.now() - startTime;

    // 감사 로그: 도구 실행 — Design §8
    const maskedInput = maskPII(JSON.stringify(rawArguments));
    await logAiEvent(
      'MCP_TOOL_CALL', context.userId, context.requestId, context.tenantId,
      'mcp-server', 'mcp-client',
      { toolName, maskedInput, durationMs, isError: result.isError ?? false },
    );

    return createSuccessResponse(request.id, result);
  }

  // ── prompts/list — Design §4 ──────────────────────────────────────

  private async handlePromptsList(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this.config.promptProvider) {
      return createSuccessResponse(request.id, { prompts: [] });
    }
    const prompts = await this.config.promptProvider.list();
    return createSuccessResponse(request.id, { prompts });
  }

  // ── prompts/get — Design §4 ───────────────────────────────────────

  private async handlePromptsGet(request: JSONRPCRequest, context: ToolContext): Promise<JSONRPCResponse> {
    if (!this.config.promptProvider) {
      return createErrorResponse(request.id, JSONRPC_METHOD_NOT_FOUND, '프롬프트 프로바이더 미설정');
    }

    const name = request.params?.['name'];
    if (typeof name !== 'string') {
      return createErrorResponse(request.id, JSONRPC_INVALID_PARAMS, 'name 파라미터가 필요합니다');
    }

    const args = (request.params?.['arguments'] ?? {}) as Record<string, string>;

    // 감사 로그
    await logAiEvent(
      'MCP_PROMPT_GET', context.userId, context.requestId, context.tenantId,
      'mcp-server', 'mcp-client',
      { promptName: name },
    );

    const result = await this.config.promptProvider.get(name, args);
    return createSuccessResponse(request.id, result);
  }
}

// ── 유틸리티 함수 ────────────────────────────────────────────────────────────

/** JSON-RPC 요청 검증 */
function validateJSONRPCRequest(data: Record<string, unknown>): JSONRPCRequest {
  if (data['jsonrpc'] !== '2.0') {
    throw new Error('jsonrpc 필드가 "2.0"이어야 합니다');
  }
  if (typeof data['method'] !== 'string') {
    throw new Error('method 필드가 문자열이어야 합니다');
  }
  return {
    jsonrpc: '2.0',
    id: (data['id'] as string | number) ?? 0,
    method: data['method'] as string,
    params: data['params'] as Record<string, unknown> | undefined,
  };
}

/** JSON-RPC 성공 응답 생성 */
function createSuccessResponse(id: string | number, result: unknown): JSONRPCResponse {
  return { jsonrpc: '2.0', id, result };
}

/** JSON-RPC 에러 응답 생성 */
function createErrorResponse(id: string | number, code: number, message: string): JSONRPCResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Zod 스키마를 JSON Schema 형식으로 변환 (MCP tools/list 응답용)
 * 간소화 버전: 기본 타입만 지원
 */
function zodToJSONSchema(schema: z.ZodSchema): Record<string, unknown> {
  // Zod의 내부 정의에서 JSON Schema 추출
  // 완전한 변환은 zod-to-json-schema 라이브러리가 필요하지만
  // 외부 의존성 최소화를 위해 기본 구조만 반환
  try {
    const description = schema.description ?? '';
    return {
      type: 'object',
      description,
      // 실제 프로퍼티는 도구 등록 시 명시적으로 제공하는 것을 권장
      additionalProperties: true,
    };
  } catch {
    return { type: 'object' };
  }
}

// ── 팩토리 함수 ──────────────────────────────────────────────────────────────

/**
 * 공공기관 SaaS용 MCP 서버 인스턴스를 생성합니다.
 *
 * @param config - 서버 설정
 * @returns MCPServer 인스턴스
 */
export function createMCPServer(config: MCPServerConfig): MCPServer {
  return new MCPServer(config);
}
