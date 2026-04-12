# SVC-AI-ADV-R7: MCP (Model Context Protocol) 서버 — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R7.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Design Anchor

### 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| A: @modelcontextprotocol/sdk 의존 | 공식 SDK, 빠른 구현 | 외부 의존성, 번들 크기 | 중간 |
| B: 자체 MCP 프로토콜 구현 (선택) | 의존성 제로, 완전 제어, 공공기관 보안 요건 맞춤 | 구현 비용 | **높음** |
| C: 외부 MCP 프록시 서비스 | 관리 편의 | 외부 서비스 금지(CLAUDE.md §1) | 불가 |

**선택: 옵션 B — 자체 구현 (Pragmatic Balance)**
- MCP 프로토콜은 JSON-RPC 2.0 기반으로 복잡하지 않음
- 공공기관 RBAC/감사 로그 요건을 네이티브로 통합
- 외부 의존성 최소화 (CLAUDE.md §1)

---

## §1 MCP 서버 코어 (mcp-server.ts)

### 1.1 JSON-RPC 2.0 메시지 구조

```typescript
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
```

### 1.2 MCP 메서드 라우팅

| 메서드 | 설명 |
|--------|------|
| initialize | 서버 초기화, 기능(capabilities) 교환 |
| resources/list | 사용 가능한 리소스 목록 |
| resources/read | 리소스 내용 읽기 |
| tools/list | 사용 가능한 도구 목록 |
| tools/call | 도구 실행 |
| prompts/list | 프롬프트 템플릿 목록 |
| prompts/get | 프롬프트 템플릿 렌더링 |

### 1.3 서버 초기화 응답

```typescript
{
  protocolVersion: '2025-03-26',
  capabilities: {
    resources: { subscribe: false, listChanged: true },
    tools: { listChanged: true },
    prompts: { listChanged: true },
  },
  serverInfo: {
    name: 'public-saas-mcp',
    version: '1.0.0',
  }
}
```

---

## §2 MCP Resources (mcp-resources.ts)

### 2.1 공공기관 리소스 유형

| 리소스 URI | 설명 | MIME |
|-----------|------|------|
| law://statutes/{id} | 법령 전문 | text/plain |
| template://official-docs/{type} | 공문서 양식 | text/html |
| data://admin-codes/{code} | 행정구역 코드 | application/json |
| policy://csap/{control-id} | CSAP 통제항목 | text/markdown |

### 2.2 리소스 프로바이더 인터페이스

```typescript
interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface MCPResourceProvider {
  list(): Promise<MCPResource[]>;
  read(uri: string): Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }>;
}
```

---

## §3 MCP Tools (mcp-tools.ts)

### 3.1 공공기관 도메인 도구

| 도구 이름 | 설명 | 입력 스키마 |
|----------|------|-----------|
| search_statute | 법령 키워드 검색 | { query: string, limit?: number } |
| generate_official_doc | 공문서 초안 생성 | { type: string, params: Record } |
| query_admin_db | 행정 DB 조회 (읽기 전용) | { table: string, filter: Record } |
| check_csap_compliance | CSAP 준수 상태 확인 | { controlIds: string[] } |
| calculate_fee | 수수료/과태료 계산 | { type: string, amount: number } |

### 3.2 도구 정의 인터페이스

```typescript
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  requiredPermission: string;  // RBAC 권한
  handler: (input: unknown, context: ToolContext) => Promise<ToolResult>;
}
```

---

## §4 MCP Prompts

### 4.1 공공기관 프롬프트 템플릿

| 프롬프트 이름 | 설명 | 인자 |
|-------------|------|------|
| legal_analysis | 법령 분석 보고서 작성 | statuteId, question |
| official_letter | 공문서 작성 | recipient, subject, body |
| compliance_report | 준수 현황 보고서 | scope, period |

---

## §5 RBAC 권한 제어 (CSAP D-08)

- 각 도구에 requiredPermission 필드
- 도구 호출 전 사용자 권한 확인
- 권한 부족 시 JSON-RPC 에러 (-32603)

---

## §6 입력 검증 (CSAP D-12)

- 모든 도구 입력은 Zod 스키마로 검증
- 검증 실패 시 JSON-RPC Invalid params 에러 (-32602)

---

## §7 동적 도구 관리

- registerTool(): 런타임 도구 등록
- unregisterTool(): 런타임 도구 해제
- 도구 목록 변경 시 listChanged 알림

---

## §8 감사 로그 (CSAP D-06)

- 모든 도구 호출: actor, tool, input(마스킹), result, timestamp 기록
- 모든 리소스 접근: actor, uri, timestamp 기록

---

## Session Guide

### 구현 순서

1. mcp-server.ts: JSON-RPC 라우터 + initialize + RBAC + 감사 로그 + 동적 관리
2. mcp-resources.ts: 리소스 프로바이더 (법령, 공문서, 행정코드, CSAP)
3. mcp-tools.ts: 도구 정의 + 핸들러 (법령검색, 공문서생성, DB조회, CSAP확인, 수수료)
