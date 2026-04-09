# MCP 통합 가이드 (Model Context Protocol)

> MTU-A1 | AI-REQ-2 | 적용 기준일: 2026-04-05
> 참조: MCP 1.0 (Linux Foundation), N2SF N-05

---

## 1. 개요

MCP(Model Context Protocol)는 AI 모델이 외부 데이터 소스·도구에 표준화된 방식으로 접근하는 프로토콜입니다.
공공기관 SaaS에서 MCP 서버를 통해 안전한 AI 도구 통합을 구현합니다.

---

## 2. 아키텍처

```
공공시스템 DB --> MCP Server (감사로그 포함)
                    |
                    +-- Claude API (O등급만, PII 마스킹 후)
                    +-- LM Studio (C/S등급, 온프레미스)
                    |
                    v
                 AI 응답 --> 응답 PII 필터링 --> 사용자
```

---

## 3. MCP 서버 구현 (TypeScript)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({
  name: 'public-saas-mcp',
  version: '1.0.0',
})

// Tool 1: 공공 데이터 조회 (N2SF 등급 자동 분류)
server.tool(
  'query-public-data',
  '공공 데이터베이스 조회 (N2SF 등급 자동 분류 적용)',
  {
    query: z.string().describe('조회 쿼리'),
    dataSource: z.enum(['statistics', 'policy', 'regulation']).describe('데이터 소스'),
  },
  async ({ query, dataSource }) => {
    // N2SF 등급 자동 분류
    const classification = classifyData(query)

    // 감사 로그 기록
    await auditLog({
      actor: 'mcp-server',
      action: 'MCP_TOOL_CALL',
      resource: 'query-public-data',
      details: { dataSource, grade: classification.grade },
      csapControls: ['CSAP-D08-10'],
    })

    // C/S등급 데이터 접근 차단
    if (classification.grade !== DataGrade.O) {
      return {
        content: [{
          type: 'text',
          text: `접근 차단: ${classification.grade}등급 데이터는 AI 도구 접근 금지 (N2SF N-05)`,
        }],
        isError: true,
      }
    }

    // O등급: 데이터 조회 실행
    const result = await db.execute(
      'SELECT * FROM public_data WHERE source = $1 AND query LIKE $2',
      [dataSource, `%${query}%`]
    )

    return {
      content: [{ type: 'text', text: JSON.stringify(result.rows) }],
    }
  }
)

// Tool 2: CSAP 체크리스트 상태 조회
server.tool(
  'csap-checklist-status',
  'CSAP 79항목 준수 현황 조회',
  {
    domain: z.string().optional().describe('분야 (D-01~D-13, 생략 시 전체)'),
  },
  async ({ domain }) => {
    await auditLog({
      actor: 'mcp-server',
      action: 'MCP_TOOL_CALL',
      resource: 'csap-checklist-status',
    })

    // 체크리스트 상태 조회 (O등급 데이터)
    const filter = domain ? { domain } : {}
    const items = await db.csapChecklist.findMany({ where: filter })
    const done = items.filter(i => i.status === 'done').length

    return {
      content: [{
        type: 'text',
        text: `CSAP 준수 현황: ${done}/${items.length} (${Math.round(done/items.length*100)}%)`,
      }],
    }
  }
)

// MCP 서버 시작
const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## 4. MCP 클라이언트 설정

### 4.1 Claude Desktop / Claude Code 연동

```json
{
  "mcpServers": {
    "public-saas": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "AUDIT_FILE": "/var/log/audit.jsonl"
      }
    }
  }
}
```

---

## 5. 보안 요건

| 요건 | 구현 | CSAP/N2SF |
|------|------|---------|
| 모든 도구 호출 감사 로그 | auditLog() 자동 기록 | CSAP-D06-01 |
| N2SF 등급 자동 분류 | classifyData() 훅 | N2SF N-05 |
| C/S등급 접근 차단 | MCP Tool 내 등급 검사 | N2SF N-05 |
| 응답 PII 필터링 | maskPII() 후처리 | ISMS-P-I-14 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A1 Do — MCP 통합 가이드 작성 | Implementer Agent |
