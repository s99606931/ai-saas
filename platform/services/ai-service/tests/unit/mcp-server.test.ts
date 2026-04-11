// SVC-AI-ADV-R7 단위 테스트: MCP 서버 코어
// Design Ref: SVC-AI-ADV-R7 DESIGN §1, §2, §3, §4, §5, §7, §8
// Plan SC: FR-ADV7.1, FR-ADV7.2, FR-ADV7.3, FR-ADV7.4, FR-ADV7.5, FR-ADV7.7, FR-ADV7.8
// CSAP: D-08, D-06, D-12

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// logAiEvent 모의: mcp-server가 import하는 audit.js를 모의
vi.mock('../../src/lib/audit.js', () => ({
  logAiEvent: vi.fn().mockResolvedValue(undefined),
}));

// maskPII 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  MCPServer,
  createMCPServer,
} from '../../src/lib/mcp-server.js';
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPToolResult,
  ToolContext,
  JSONRPCResponse,
  MCPResourceProvider,
  MCPPromptProvider,
} from '../../src/lib/mcp-server.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

function createTestContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    userId: 'user-001',
    tenantId: 'tenant-001',
    roles: ['admin'],
    requestId: 'req-001',
    ...overrides,
  };
}

function createTestConfig(overrides?: Partial<MCPServerConfig>): MCPServerConfig {
  return {
    serverInfo: { name: 'test-mcp', version: '1.0.0' },
    permissionChecker: () => true,
    ...overrides,
  };
}

function createTestTool(name: string, permission: string = 'test:read'): MCPToolDefinition {
  return {
    name,
    description: `테스트 도구: ${name}`,
    inputSchema: z.object({ query: z.string() }),
    requiredPermission: permission,
    handler: async (input: unknown): Promise<MCPToolResult> => {
      const params = input as { query: string };
      return { content: [{ type: 'text', text: `결과: ${params.query}` }] };
    },
  };
}

function jsonrpc(method: string, params?: Record<string, unknown>, id: number | string = 1): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('MCPServer 초기화 (FR-ADV7.1)', () => {
  it('createMCPServer로 인스턴스를 생성한다', () => {
    const server = createMCPServer(createTestConfig());
    expect(server).toBeInstanceOf(MCPServer);
  });

  it('초기화 전 isInitialized는 false다', () => {
    const server = createMCPServer(createTestConfig());
    expect(server.isInitialized).toBe(false);
  });

  it('initialize 요청 후 isInitialized는 true다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('initialize'), ctx);
    expect(server.isInitialized).toBe(true);
    expect(response.result).toBeDefined();
  });

  it('initialize 응답에 protocolVersion이 포함된다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('initialize'), ctx);
    const result = response.result as Record<string, unknown>;
    expect(result['protocolVersion']).toBe('2025-03-26');
  });

  it('initialize 응답에 capabilities가 포함된다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('initialize'), ctx);
    const result = response.result as Record<string, unknown>;
    const caps = result['capabilities'] as Record<string, unknown>;
    expect(caps['resources']).toBeDefined();
    expect(caps['tools']).toBeDefined();
    expect(caps['prompts']).toBeDefined();
  });

  it('initialize 응답에 serverInfo가 포함된다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('initialize'), ctx);
    const result = response.result as Record<string, unknown>;
    const info = result['serverInfo'] as Record<string, string>;
    expect(info['name']).toBe('test-mcp');
    expect(info['version']).toBe('1.0.0');
  });
});

describe('JSON-RPC 2.0 프로토콜 (FR-ADV7.4)', () => {
  let server: MCPServer;
  const ctx = createTestContext();

  beforeEach(() => {
    server = createMCPServer(createTestConfig());
  });

  it('올바른 JSON-RPC 응답 형식을 반환한다', async () => {
    const response = await server.handleRequest(jsonrpc('initialize'), ctx);
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
  });

  it('잘못된 JSON은 Parse Error를 반환한다', async () => {
    const response = await server.handleRequest('not json{{{', ctx);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32700);
  });

  it('존재하지 않는 메서드는 Method Not Found를 반환한다', async () => {
    const response = await server.handleRequest(jsonrpc('nonexistent/method'), ctx);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32601);
  });

  it('객체 형식 요청도 처리한다', async () => {
    const requestObj = { jsonrpc: '2.0' as const, id: 42, method: 'initialize' };
    const response = await server.handleRequest(requestObj, ctx);
    expect(response.id).toBe(42);
    expect(response.result).toBeDefined();
  });

  it('문자열 ID도 지원한다', async () => {
    const response = await server.handleRequest(jsonrpc('initialize', undefined, 'abc-123'), ctx);
    expect(response.id).toBe('abc-123');
  });
});

describe('도구 동적 관리 (FR-ADV7.7)', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = createMCPServer(createTestConfig());
  });

  it('도구를 등록한다', () => {
    server.registerTool(createTestTool('search_statute'));
    expect(server.toolCount).toBe(1);
  });

  it('여러 도구를 등록한다', () => {
    server.registerTool(createTestTool('search_statute'));
    server.registerTool(createTestTool('generate_doc'));
    expect(server.toolCount).toBe(2);
  });

  it('도구를 해제한다', () => {
    server.registerTool(createTestTool('search_statute'));
    const result = server.unregisterTool('search_statute');
    expect(result).toBe(true);
    expect(server.toolCount).toBe(0);
  });

  it('존재하지 않는 도구 해제 시 false를 반환한다', () => {
    const result = server.unregisterTool('nonexistent');
    expect(result).toBe(false);
  });
});

describe('tools/list (FR-ADV7.3)', () => {
  it('등록된 도구 목록을 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    server.registerTool(createTestTool('search_statute'));
    server.registerTool(createTestTool('generate_doc'));

    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('tools/list'), ctx);
    const result = response.result as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(2);
    expect(result.tools.map((t) => t.name)).toContain('search_statute');
    expect(result.tools.map((t) => t.name)).toContain('generate_doc');
  });

  it('도구 정보에 name, description, inputSchema가 포함된다', async () => {
    const server = createMCPServer(createTestConfig());
    server.registerTool(createTestTool('search_statute'));

    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('tools/list'), ctx);
    const result = response.result as { tools: Array<Record<string, unknown>> };
    const tool = result.tools[0]!;
    expect(tool['name']).toBe('search_statute');
    expect(tool['description']).toBeDefined();
    expect(tool['inputSchema']).toBeDefined();
  });

  it('등록된 도구가 없으면 빈 배열을 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('tools/list'), ctx);
    const result = response.result as { tools: unknown[] };
    expect(result.tools).toHaveLength(0);
  });
});

describe('tools/call — RBAC 권한 검증 (FR-ADV7.5, CSAP D-08)', () => {
  it('권한 있는 사용자는 도구를 실행한다', async () => {
    const server = createMCPServer(createTestConfig({
      permissionChecker: () => true,
    }));
    server.registerTool(createTestTool('search_statute', 'mcp:statute:search'));

    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('tools/call', { name: 'search_statute', arguments: { query: '개인정보보호법' } }),
      ctx,
    );
    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ text: string }> };
    expect(result.content[0]?.text).toContain('개인정보보호법');
  });

  it('권한 없는 사용자는 차단된다', async () => {
    const server = createMCPServer(createTestConfig({
      permissionChecker: () => false,
    }));
    server.registerTool(createTestTool('search_statute', 'mcp:statute:search'));

    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('tools/call', { name: 'search_statute', arguments: { query: '테스트' } }),
      ctx,
    );
    expect(response.error).toBeDefined();
    expect(response.error?.message).toContain('권한');
  });

  it('존재하지 않는 도구 호출 시 에러를 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('tools/call', { name: 'nonexistent', arguments: {} }),
      ctx,
    );
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32601);
  });

  it('name 파라미터 누락 시 에러를 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('tools/call', { arguments: {} }),
      ctx,
    );
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32602);
  });

  it('잘못된 입력은 검증 에러를 반환한다 (CSAP D-12)', async () => {
    const server = createMCPServer(createTestConfig());
    server.registerTool(createTestTool('search_statute'));

    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('tools/call', { name: 'search_statute', arguments: { query: 123 } }),
      ctx,
    );
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32602);
  });
});

describe('resources/list & resources/read (FR-ADV7.2)', () => {
  const mockResourceProvider: MCPResourceProvider = {
    list: vi.fn().mockResolvedValue([
      { uri: 'law://statutes/act-001', name: '개인정보보호법', description: '법령', mimeType: 'text/plain' },
    ]),
    read: vi.fn().mockResolvedValue({
      contents: [{ uri: 'law://statutes/act-001', text: '개인정보보호법 전문', mimeType: 'text/plain' }],
    }),
  };

  it('리소스 프로바이더 없으면 빈 배열을 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('resources/list'), ctx);
    const result = response.result as { resources: unknown[] };
    expect(result.resources).toHaveLength(0);
  });

  it('리소스 목록을 반환한다', async () => {
    const server = createMCPServer(createTestConfig({ resourceProvider: mockResourceProvider }));
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('resources/list'), ctx);
    const result = response.result as { resources: Array<{ name: string }> };
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.name).toBe('개인정보보호법');
  });

  it('리소스 내용을 읽는다', async () => {
    const server = createMCPServer(createTestConfig({ resourceProvider: mockResourceProvider }));
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('resources/read', { uri: 'law://statutes/act-001' }),
      ctx,
    );
    const result = response.result as { contents: Array<{ text: string }> };
    expect(result.contents[0]?.text).toContain('개인정보보호법');
  });

  it('uri 파라미터 누락 시 에러를 반환한다', async () => {
    const server = createMCPServer(createTestConfig({ resourceProvider: mockResourceProvider }));
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('resources/read', {}),
      ctx,
    );
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32602);
  });

  it('리소스 프로바이더 없이 read 시 에러를 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('resources/read', { uri: 'law://statutes/act-001' }),
      ctx,
    );
    expect(response.error).toBeDefined();
  });
});

describe('prompts/list & prompts/get (FR-ADV7.8)', () => {
  const mockPromptProvider: MCPPromptProvider = {
    list: vi.fn().mockResolvedValue([
      { name: 'law_analysis', description: '법령 분석', arguments: [{ name: 'statute', description: '법령명', required: true }] },
    ]),
    get: vi.fn().mockResolvedValue({
      messages: [{ role: 'user', content: { type: 'text', text: '법령을 분석해주세요' } }],
    }),
  };

  it('프롬프트 프로바이더 없으면 빈 배열을 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('prompts/list'), ctx);
    const result = response.result as { prompts: unknown[] };
    expect(result.prompts).toHaveLength(0);
  });

  it('프롬프트 목록을 반환한다', async () => {
    const server = createMCPServer(createTestConfig({ promptProvider: mockPromptProvider }));
    const ctx = createTestContext();
    const response = await server.handleRequest(jsonrpc('prompts/list'), ctx);
    const result = response.result as { prompts: Array<{ name: string }> };
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.name).toBe('law_analysis');
  });

  it('프롬프트를 가져온다', async () => {
    const server = createMCPServer(createTestConfig({ promptProvider: mockPromptProvider }));
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('prompts/get', { name: 'law_analysis', arguments: { statute: '개인정보보호법' } }),
      ctx,
    );
    const result = response.result as { messages: Array<{ content: { text: string } }> };
    expect(result.messages).toHaveLength(1);
  });

  it('name 파라미터 누락 시 에러를 반환한다', async () => {
    const server = createMCPServer(createTestConfig({ promptProvider: mockPromptProvider }));
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('prompts/get', {}),
      ctx,
    );
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32602);
  });

  it('프롬프트 프로바이더 없이 get 시 에러를 반환한다', async () => {
    const server = createMCPServer(createTestConfig());
    const ctx = createTestContext();
    const response = await server.handleRequest(
      jsonrpc('prompts/get', { name: 'test' }),
      ctx,
    );
    expect(response.error).toBeDefined();
  });
});
