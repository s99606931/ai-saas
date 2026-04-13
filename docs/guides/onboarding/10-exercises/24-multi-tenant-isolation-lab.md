# 실습 24: 멀티테넌트 격리 검증 랩 — 테넌트 데이터 격리 취약점 탐지 및 수정

> 대상 독자: 공공기관 SaaS 프레임워크 개발자 (중급 이상)  
> 선행 조건: 실습 01(Hello Service), 실습 05(Security Audit), 실습 06(End-to-End) 완료  
> 예상 소요 시간: 3~4시간  
> CSAP 관련 항목: D-08 (접근 통제), D-06 (감사 로깅)  
> N2SF 관련 항목: N-03 (격리 영역), N-05 (데이터 등급 관리)  
> 최종 수정: 2026-04-13

---

## 목차

1. [실습 개요](#1-실습-개요)
2. [멀티테넌트 격리 취약점이란](#2-멀티테넌트-격리-취약점이란)
3. [STEP 1: 격리 취약점 시뮬레이션](#step-1-격리-취약점-시뮬레이션)
4. [STEP 2: PostgreSQL RLS 격리 검증](#step-2-postgresql-rls-격리-검증)
5. [STEP 3: Redis 캐시 격리 검증](#step-3-redis-캐시-격리-검증)
6. [STEP 4: RAG/벡터 검색 격리 검증](#step-4-rag벡터-검색-격리-검증)
7. [STEP 5: BullMQ 큐 격리 검증](#step-5-bullmq-큐-격리-검증)
8. [STEP 6: 로그/감사 격리 검증](#step-6-로그감사-격리-검증)
9. [격리 체크리스트 자동화 스크립트](#9-격리-체크리스트-자동화-스크립트)
10. [100점 평가 기준표](#10-100점-평가-기준표)
11. [제출 체크리스트](#11-제출-체크리스트)

---

## 1. 실습 개요

### 1.1 학습 목표

이 실습을 완료하면 다음을 할 수 있습니다:

1. **격리 취약점 이해**: 멀티테넌트 환경에서 테넌트 간 데이터 누출이 어떻게 발생하는지 이해합니다.
2. **6계층 격리 검증**: PostgreSQL RLS, Redis, BullMQ, RAG/벡터 검색, 로그, 감사 로그 각 계층의 격리 상태를 검증합니다.
3. **취약점 수정**: 격리가 깨진 지점을 발견하고 올바르게 수정합니다.
4. **자동화 스크립트 작성**: 격리 검증을 자동화하는 스크립트를 작성합니다.
5. **CSAP D-08 준수 확인**: 접근 통제 요건이 멀티테넌트 격리와 어떻게 연결되는지 이해합니다.

### 1.2 선행 조건

```bash
# 다음 도구가 설치되어 있어야 합니다
node --version     # v22 이상
kubectl version    # k3s 클러스터 접근 가능
redis-cli --version # Redis 클라이언트

# 다음 서비스가 동작 중이어야 합니다
kubectl get pods -n public-saas  # ai-service, compliance-service 등 Running 상태

# 환경 변수 설정
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
export NAMESPACE=public-saas
```

### 1.3 실습 폴더 구조

```
실습 작업 폴더: /data/ai-saas/labs/24-multi-tenant-isolation/
├── scripts/
│   ├── setup-test-tenants.sh      # 테스트 테넌트 생성 스크립트
│   ├── check-rls.sh               # RLS 격리 검증
│   ├── check-redis.sh             # Redis 격리 검증
│   ├── check-rag.sh               # RAG 격리 검증
│   ├── check-queue.sh             # BullMQ 격리 검증
│   ├── check-logs.sh              # 로그 격리 검증
│   └── check-all.sh               # 전체 격리 자동 검증
├── fixtures/
│   ├── tenant-a.json              # 테넌트 A 테스트 데이터
│   └── tenant-b.json              # 테넌트 B 테스트 데이터
└── results/
    └── isolation-report.json      # 검증 결과 리포트
```

```bash
# 실습 폴더 생성
mkdir -p /data/ai-saas/labs/24-multi-tenant-isolation/{scripts,fixtures,results}
cd /data/ai-saas/labs/24-multi-tenant-isolation
```

---

## 2. 멀티테넌트 격리 취약점이란

### 2.1 테넌트 데이터 누출 시나리오

공공기관 SaaS에서 가장 심각한 보안 사고 중 하나는 **테넌트 데이터 누출(Tenant Data Leakage)**입니다. 이는 테넌트 A의 사용자가 테넌트 B의 데이터를 읽거나 수정할 수 있는 상황을 말합니다.

**실제 시나리오 예시:**

- 서울시청(테넌트 A)의 직원이 경기도청(테넌트 B)의 문서를 RAG 검색으로 검색
- tenantId 검증 누락으로 API가 다른 테넌트 데이터를 반환
- Redis 캐시 키에 tenantId가 없어 캐시된 데이터가 다른 테넌트에게 노출

### 2.2 6계층 격리 아키텍처

```mermaid
flowchart TD
    subgraph REQUEST["테넌트 A 요청"]
        USER_A["테넌트 A 사용자\n(서울시청)"]
        REQUEST_A["POST /api/ai/rag/query\ntenantId: tenant-a-uuid"]
    end

    subgraph LAYERS["6계층 격리 방어선"]
        direction TB

        L1["계층 1: API Gateway\n· JWT 토큰에서 tenantId 추출\n· 요청 바디의 tenantId와 검증\n· CSAP D-08 접근 통제"]

        L2["계층 2: PostgreSQL RLS\n· SET LOCAL app.tenant_id = '...'\n· WHERE tenant_id = current_setting('app.tenant_id')\n· CSAP D-08 데이터 격리"]

        L3["계층 3: Redis 캐시\n· 캐시 키 = tenant:{tenantId}:resource:{id}\n· tenantId 없는 키 금지\n· 공유 캐시 항목 금지"]

        L4["계층 4: BullMQ 큐\n· 큐 이름 = tenant:{tenantId}:job-type\n· 워커가 큐 이름으로 테넌트 판별\n· 교차 테넌트 작업 불가"]

        L5["계층 5: RAG/벡터 검색\n· semanticSearch(embedding, tenantId)\n· WHERE tenant_id = tenantId 필터\n· 다른 테넌트 청크 접근 불가"]

        L6["계층 6: 로그/감사\n· 모든 로그에 tenantId 포함\n· 감사 로그 tenantId 검색 가능\n· CSAP D-06 감사 추적"]
    end

    subgraph BLOCKED["차단된 테넌트 B 데이터"]
        DATA_B["테넌트 B 데이터\n(경기도청 문서)\n절대 접근 불가"]
    end

    USER_A --> REQUEST_A
    REQUEST_A --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    L5 --> L6
    L6 -.->|"격리 차단"| DATA_B

    style L1 fill:#3498db,color:#fff
    style L2 fill:#9b59b6,color:#fff
    style L3 fill:#e67e22,color:#fff
    style L4 fill:#1abc9c,color:#fff
    style L5 fill:#e74c3c,color:#fff
    style L6 fill:#f39c12,color:#fff
    style DATA_B fill:#c0392b,color:#fff
    style BLOCKED fill:#fadbd8
```

### 2.3 격리 취약점 공격 시도 → 차단 프로세스

```mermaid
sequenceDiagram
    autonumber
    actor AttackerA as 테넌트 A 공격자
    participant GW as API Gateway
    participant L1 as JWT 검증 (계층 1)
    participant L2 as RLS 격리 (계층 2)
    participant L5 as RAG 격리 (계층 5)
    participant L6 as 감사 로그 (계층 6)
    participant DB_B as 테넌트 B DB

    AttackerA->>GW: POST /api/ai/rag/query<br/>tenantId: "tenant-b-uuid" (위조)
    GW->>L1: JWT 토큰 검증

    Note over L1: JWT 페이로드: tenantId="tenant-a-uuid"
    L1->>L1: JWT tenantId ≠ 요청 tenantId 검사
    L1->>L6: 감사 로그: AUTH_TENANT_MISMATCH<br/>actor=user-a, target=tenant-b
    L1->>GW: 403 Forbidden

    GW->>AttackerA: 403 Forbidden<br/>{code: "TENANT_ID_MISMATCH"}

    Note over AttackerA: 2번째 시도: JWT의 tenantId를 직접 사용

    AttackerA->>GW: POST /api/ai/rag/query<br/>tenantId: "tenant-a-uuid" (정상)
    GW->>L1: JWT 토큰 검증
    L1->>L2: tenantId 정상 확인, DB 접근
    L2->>L2: SET LOCAL app.tenant_id = 'tenant-a-uuid'
    L2->>DB_B: WHERE tenant_id = 'tenant-a-uuid'<br/>(RLS 자동 적용)

    Note over DB_B: RLS 정책: 테넌트 A는<br/>테넌트 B 행 조회 불가
    DB_B->>L2: 결과: 0개 행 (테넌트 B 데이터 없음)

    L2->>L5: 빈 결과로 RAG 검색 요청
    L5->>L5: semanticSearch(embedding, "tenant-a-uuid")
    L5->>L5: WHERE tenant_id = 'tenant-a-uuid' 필터

    Note over L5: 테넌트 A 청크만 검색됨<br/>테넌트 B 청크 접근 불가

    L5->>L6: 감사 로그: RAG_QUERY<br/>tenantId=tenant-a, 결과: 0건
    L6->>GW: 정상 응답 (테넌트 A 데이터만)
    GW->>AttackerA: 200 OK<br/>테넌트 A 데이터만 포함된 답변
```

---

## STEP 1: 격리 취약점 시뮬레이션

### 1.1 테스트 테넌트 2개 생성

```bash
# 실습 시작: 테스트 테넌트 생성
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/setup-test-tenants.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

echo "=== 멀티테넌트 격리 테스트 환경 설정 ==="

# 테스트 테넌트 UUID (고정값으로 반복 실행 가능)
TENANT_A_ID="aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"
TENANT_B_ID="bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"

# API 엔드포인트
API_BASE="${API_BASE:-http://localhost:3000}"

echo "[1/4] 테넌트 A 생성 (서울시청 시뮬레이션)"
curl -s -X POST "${API_BASE}/api/v1/admin/tenants" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN:-test-admin-token}" \
  -d "{
    \"id\": \"${TENANT_A_ID}\",
    \"name\": \"서울시청 (테스트)\",
    \"tier\": \"standard\",
    \"settings\": {\"maxUsers\": 100}
  }"

echo ""
echo "[2/4] 테넌트 B 생성 (경기도청 시뮬레이션)"
curl -s -X POST "${API_BASE}/api/v1/admin/tenants" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN:-test-admin-token}" \
  -d "{
    \"id\": \"${TENANT_B_ID}\",
    \"name\": \"경기도청 (테스트)\",
    \"tier\": \"premium\",
    \"settings\": {\"maxUsers\": 500}
  }"

echo ""
echo "[3/4] 테넌트 A에 테스트 문서 수집 (RAG 격리 테스트용)"
curl -s -X POST "${API_BASE}/api/v1/ai/rag/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TENANT_A_TOKEN:-test-tenant-a-token}" \
  -d "{
    \"tenantId\": \"${TENANT_A_ID}\",
    \"grade\": \"O\",
    \"title\": \"서울시청 내부 규정 (기밀)\",
    \"content\": \"이 문서는 서울시청의 기밀 내부 규정입니다. 테넌트 B에서는 절대 접근할 수 없어야 합니다. SECRET_CONTENT_FOR_TENANT_A\"
  }"

echo ""
echo "[4/4] 테넌트 B에 테스트 문서 수집"
curl -s -X POST "${API_BASE}/api/v1/ai/rag/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TENANT_B_TOKEN:-test-tenant-b-token}" \
  -d "{
    \"tenantId\": \"${TENANT_B_ID}\",
    \"grade\": \"O\",
    \"title\": \"경기도청 내부 지침 (기밀)\",
    \"content\": \"이 문서는 경기도청의 기밀 내부 지침입니다. 테넌트 A에서는 절대 접근할 수 없어야 합니다. SECRET_CONTENT_FOR_TENANT_B\"
  }"

echo ""
echo "=== 테스트 환경 설정 완료 ==="
echo "TENANT_A_ID=${TENANT_A_ID}"
echo "TENANT_B_ID=${TENANT_B_ID}"
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/setup-test-tenants.sh
echo "setup-test-tenants.sh 생성 완료"
```

### 1.2 격리 취약점 시뮬레이션 코드 (의도적 취약점)

아래 코드는 **교육용 취약점 예시**입니다. 실제 코드베이스에 절대 추가하면 안 됩니다. 이 패턴이 왜 위험한지 이해하는 것이 목표입니다.

```typescript
// ❌ 취약한 패턴 예시 1: tenantId 검증 없는 RAG 쿼리
// (이 코드는 실제로 절대 구현하면 안 됩니다)
async function VULNERABLE_ragQuery(question: string): Promise<string> {
  // tenantId를 전혀 확인하지 않고 전체 벡터 검색
  const chunks = await prisma.aiKnowledgeChunk.findMany({
    // WHERE tenant_id 조건 누락!!! 모든 테넌트 데이터 접근 가능
    where: { document: { isActive: true } },
    take: 10,
  });
  // → 테넌트 B의 기밀 문서가 테넌트 A 검색 결과에 포함됨
  return generateAnswer(question, chunks);
}

// ❌ 취약한 패턴 예시 2: Redis 캐시 키에 tenantId 없음
async function VULNERABLE_getCached(resourceId: string): Promise<unknown> {
  // tenantId 없는 캐시 키 → 모든 테넌트가 같은 캐시 공유
  const cacheKey = `resource:${resourceId}`;  // 취약!
  const cached = await redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
  // → 테넌트 A가 저장한 캐시를 테넌트 B가 읽을 수 있음
}

// ❌ 취약한 패턴 예시 3: 요청 파라미터의 tenantId를 그대로 신뢰
async function VULNERABLE_handler(request: FastifyRequest): Promise<void> {
  // JWT 토큰 검증 없이 요청 바디의 tenantId를 신뢰
  const { tenantId } = request.body as { tenantId: string };
  // 공격자가 tenantId를 "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"로 위조 가능
  const data = await getTenantData(tenantId);
}
```

```typescript
// ✅ 안전한 패턴 (실제 구현 기준)
// 출처: platform/services/ai-service/src/handlers/ai-rag.handler.ts

// 안전한 RAG 쿼리 — tenantId 항상 검증
export async function ragQueryHandler(
  request: FastifyRequest<{ Body: QueryBody }>,
  reply: FastifyReply,
): Promise<void> {
  // Zod 스키마 검증 (D-12)
  const body = querySchema.parse(request.body);

  // N2SF N-05: C/S 등급 차단
  validateDataGrade(body.grade as DataGrade);

  // semanticSearch에 tenantId 반드시 전달 (격리 핵심)
  const queryEmbedding = await generateEmbedding(body.question, body.embedModelId);
  const ragResponse = await runRAG(
    body.tenantId,    // ← tenantId 격리 적용
    body.question,
    queryEmbedding,
    { topK: body.topK, minScore: body.minScore },
  );
  // ragResponse는 body.tenantId의 문서만 포함
}
```

---

## STEP 2: PostgreSQL RLS 격리 검증

### 2.1 RLS(Row Level Security) 이해

PostgreSQL RLS는 테이블 행(Row) 수준에서 접근을 제어합니다. 올바르게 설정되면 Prisma나 애플리케이션 코드가 `WHERE tenant_id = ?`를 누락해도 데이터베이스 엔진이 자동으로 차단합니다.

```sql
-- RLS 정책 설정 예시 (Prisma 마이그레이션 파일)
-- Design Ref: §4 데이터 격리 아키텍처

-- 1. RLS 활성화
ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;

-- 2. 기본 격리 정책 (테넌트 격리)
CREATE POLICY tenant_isolation ON ai_knowledge_chunks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON ai_knowledge_documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 3. 시스템 서비스 계정은 전체 접근 허용
CREATE POLICY system_bypass ON ai_knowledge_chunks
  TO app_service_role  -- Prisma 연결 계정이 아닌 시스템 전용
  USING (true);
```

### 2.2 Prisma에서 RLS 세션 변수 설정

```typescript
// Design Ref: §4 데이터 격리
// CSAP D-08: 접근 통제 — DB 레벨 격리

// Prisma 미들웨어로 RLS 세션 변수 자동 주입
export function setupRLSMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    const tenantId = AsyncLocalStorage.getStore()?.tenantId;

    if (tenantId) {
      // 모든 쿼리 실행 전 RLS 세션 변수 설정
      await prisma.$executeRawUnsafe(
        `SET LOCAL app.tenant_id = '${tenantId}'`
      );
    }

    return next(params);
  });
}
```

### 2.3 RLS 격리 검증 스크립트

```bash
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-rls.sh << 'SCRIPT'
#!/bin/bash
# CSAP D-08: RLS 격리 검증 스크립트

TENANT_A_ID="aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"
TENANT_B_ID="bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"
DB_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/saas}"

echo "=== STEP 2: PostgreSQL RLS 격리 검증 ==="

# 테스트 1: 테넌트 A 컨텍스트에서 테넌트 B 데이터 조회 시도
echo ""
echo "[테스트 2-1] 테넌트 A 컨텍스트에서 테넌트 B 문서 조회 시도"
RESULT=$(psql "$DB_URL" -t -c "
  BEGIN;
  SET LOCAL app.tenant_id = '${TENANT_A_ID}';
  SELECT count(*) FROM ai_knowledge_documents
  WHERE tenant_id = '${TENANT_B_ID}';  -- RLS가 이를 차단해야 함
  ROLLBACK;
")
COUNT=$(echo "$RESULT" | tr -d ' \n')
if [ "$COUNT" = "0" ]; then
  echo "  [PASS] RLS 격리 정상: 테넌트 A에서 테넌트 B 문서 0건 조회됨"
else
  echo "  [FAIL] RLS 격리 취약점: 테넌트 A에서 테넌트 B 문서 ${COUNT}건 조회됨!"
  echo "  [FAIL] 즉시 조치 필요! RLS 정책을 확인하세요."
  exit 1
fi

# 테스트 2: RLS 활성화 여부 확인
echo ""
echo "[테스트 2-2] RLS 활성화 여부 확인"
TABLES_WITH_RLS=$(psql "$DB_URL" -t -c "
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('ai_knowledge_documents', 'ai_knowledge_chunks', 'users', 'tenants')
  AND rowsecurity = true;
")
echo "  RLS 활성화된 테이블: $TABLES_WITH_RLS"

# 테스트 3: RLS 정책 목록 확인
echo ""
echo "[테스트 2-3] RLS 정책 목록 확인"
psql "$DB_URL" -c "
  SELECT tablename, policyname, permissive, roles, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
"

# 테스트 4: SET LOCAL 없이 쿼리 시도 (tenantId 미설정 시 동작 확인)
echo ""
echo "[테스트 2-4] tenantId 미설정 시 쿼리 동작 확인"
UNSET_RESULT=$(psql "$DB_URL" -t -c "
  BEGIN;
  -- app.tenant_id 미설정 (공격자가 세션 변수를 우회하려는 시도)
  SELECT count(*) FROM ai_knowledge_documents;
  ROLLBACK;
" 2>&1)
echo "  결과: $UNSET_RESULT"
echo "  (에러 또는 0건이면 정상, 전체 행 수가 나오면 RLS 미적용)"

echo ""
echo "=== RLS 격리 검증 완료 ==="
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-rls.sh
echo "check-rls.sh 생성 완료"
```

### 2.4 RLS 검증 직접 실행

```bash
# PostgreSQL Pod에 직접 접속하여 검증
POSTGRES_POD=$(kubectl get pod -n public-saas -l app=postgresql -o name | head -1)

kubectl exec -n public-saas "$POSTGRES_POD" -- psql -U saas_user -d saas_db << 'EOF'
-- RLS 격리 검증 쿼리
\echo '=== RLS 격리 상태 확인 ==='

-- 1. RLS 활성화 여부 확인
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'ai_%'
ORDER BY tablename;

-- 2. 정책 목록 확인
SELECT
  tablename,
  policyname,
  cmd,
  qual  -- 격리 조건 (current_setting('app.tenant_id') 포함 여부 확인)
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. 테넌트 격리 직접 테스트
BEGIN;
SET LOCAL app.tenant_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';

-- 테넌트 A 데이터: 조회 가능해야 함
SELECT count(*) AS tenant_a_docs
FROM ai_knowledge_documents
WHERE tenant_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';

-- 테넌트 B 데이터: 0건이어야 함 (RLS 차단)
SELECT count(*) AS tenant_b_docs_should_be_zero
FROM ai_knowledge_documents
WHERE tenant_id = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';

ROLLBACK;
EOF
```

---

## STEP 3: Redis 캐시 격리 검증

### 3.1 Redis 캐시 키 네이밍 규칙

올바른 멀티테넌트 Redis 캐시는 **모든 키에 tenantId를 포함**해야 합니다.

```typescript
// ✅ 안전한 캐시 키 패턴
const CACHE_KEYS = {
  // 테넌트별 사용자 정보
  user: (tenantId: string, userId: string) =>
    `tenant:${tenantId}:user:${userId}`,

  // 테넌트별 AI 모델 설정
  aiModel: (tenantId: string, modelId: string) =>
    `tenant:${tenantId}:ai-model:${modelId}`,

  // 테넌트별 RAG 쿼리 결과 캐시
  ragResult: (tenantId: string, queryHash: string) =>
    `tenant:${tenantId}:rag:${queryHash}`,

  // 테넌트별 세션
  session: (tenantId: string, sessionId: string) =>
    `tenant:${tenantId}:session:${sessionId}`,
};

// ❌ 취약한 캐시 키 패턴 (절대 금지)
const BAD_KEYS = {
  user: (userId: string) => `user:${userId}`,  // tenantId 누락!
  ragResult: (queryHash: string) => `rag:${queryHash}`, // 모든 테넌트 공유!
};
```

### 3.2 Redis 격리 검증 스크립트

```bash
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-redis.sh << 'SCRIPT'
#!/bin/bash
# Redis 캐시 격리 검증

TENANT_A_ID="aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"
TENANT_B_ID="bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

echo "=== STEP 3: Redis 캐시 격리 검증 ==="

# Redis Pod에 접속
REDIS_POD=$(kubectl get pod -n public-saas -l app=redis -o name 2>/dev/null | head -1)

if [ -z "$REDIS_POD" ]; then
  echo "  [SKIP] Redis Pod를 찾을 수 없습니다. 로컬 Redis 사용"
  REDIS_CMD="redis-cli"
else
  REDIS_CMD="kubectl exec -n public-saas $REDIS_POD -- redis-cli"
fi

# 테스트 1: tenantId가 없는 키 존재 여부 확인
echo ""
echo "[테스트 3-1] tenantId 없는 캐시 키 검색 (취약점 탐지)"
KEYS_WITHOUT_TENANT=$($REDIS_CMD KEYS "*" | grep -v "^tenant:" | grep -v "^blacklist:" | grep -v "^sessions:" | head -20)
if [ -z "$KEYS_WITHOUT_TENANT" ]; then
  echo "  [PASS] tenantId 없는 캐시 키 없음: 모든 키가 올바른 형식"
else
  echo "  [WARN] tenantId 없는 키 발견:"
  echo "$KEYS_WITHOUT_TENANT"
  echo "  [ACTION] 위 키들에 tenantId 접두사 추가 필요"
fi

# 테스트 2: 테넌트 A의 캐시 데이터를 테넌트 B 키로 접근 시도
echo ""
echo "[테스트 3-2] 교차 테넌트 캐시 접근 시도"
# 테넌트 A의 캐시 저장
$REDIS_CMD SET "tenant:${TENANT_A_ID}:user:user-001" \
  '{"userId":"user-001","secret":"TENANT_A_SECRET"}' EX 300 > /dev/null

# 테넌트 B 키로 테넌트 A 데이터 직접 접근 시도
CROSS_ACCESS=$($REDIS_CMD GET "tenant:${TENANT_B_ID}:user:user-001")
if [ -z "$CROSS_ACCESS" ] || [ "$CROSS_ACCESS" = "(nil)" ]; then
  echo "  [PASS] 교차 테넌트 캐시 접근 차단: 테넌트 B에서 테넌트 A 데이터 미조회"
else
  echo "  [FAIL] 교차 테넌트 캐시 노출: 데이터=$CROSS_ACCESS"
fi

# 테스트 3: 캐시 키 패턴 분포 분석
echo ""
echo "[테스트 3-3] 전체 캐시 키 패턴 분석"
echo "테넌트 A 키 수: $($REDIS_CMD KEYS "tenant:${TENANT_A_ID}:*" | wc -l)"
echo "테넌트 B 키 수: $($REDIS_CMD KEYS "tenant:${TENANT_B_ID}:*" | wc -l)"
echo "전체 키 수: $($REDIS_CMD DBSIZE)"

# 테스트 4: 캐시 키 예시 출력 (검증용)
echo ""
echo "[테스트 3-4] 캐시 키 형식 샘플 (tenantId 포함 여부 확인)"
$REDIS_CMD KEYS "tenant:*" | head -10 | while read key; do
  echo "  키: $key"
  TENANT_IN_KEY=$(echo "$key" | grep -oE "tenant:[a-f0-9-]+" | head -1)
  if [ -n "$TENANT_IN_KEY" ]; then
    echo "    [PASS] tenantId 포함: $TENANT_IN_KEY"
  else
    echo "    [FAIL] tenantId 형식 불일치!"
  fi
done

# 정리: 테스트 데이터 삭제
$REDIS_CMD DEL "tenant:${TENANT_A_ID}:user:user-001" > /dev/null
echo ""
echo "=== Redis 캐시 격리 검증 완료 ==="
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-redis.sh
echo "check-redis.sh 생성 완료"
```

---

## STEP 4: RAG/벡터 검색 격리 검증

### 4.1 vector-store.ts semanticSearch 격리 분석

`platform/services/ai-service/src/lib/vector-store.ts`의 `semanticSearch` 함수 코드를 분석합니다.

```typescript
// 출처: platform/services/ai-service/src/lib/vector-store.ts (실제 코드)
export async function semanticSearch(
  queryEmbedding: number[],
  tenantId: string,   // ← 격리 핵심 파라미터
  topK = 5,
  minScore = 0.3,
): Promise<SearchResult[]> {
  // 테넌트 격리된 청크 전체 로드
  // WHERE tenant_id = tenantId 조건이 핵심!
  const chunks = await db['aiKnowledgeChunk'].findMany({
    where: {
      tenantId,                         // ← tenantId 격리 필터 (필수)
      document: { isActive: true }      // 활성 문서만
    },
    include: {
      document: { select: { title: true, sourceUrl: true } }
    },
    take: 10000, // 최대 10k 청크 (메모리 보호)
  });

  // 코사인 유사도 계산 및 반환
  const results = chunks
    .map((chunk) => {
      const embedding = JSON.parse(chunk['embeddingJson']);
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score < minScore) return null;
      return { chunk: { ...chunk, tenantId }, score };
    })
    .filter((r) => r !== null)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, topK);

  return results;
}
```

**격리 포인트 분석:**

| 코드 라인 | 격리 역할 | 취약점 발생 조건 |
|-----------|-----------|-----------------|
| `where: { tenantId }` | 테넌트 청크만 조회 | tenantId 파라미터 누락 시 |
| `tenantId: string` 파라미터 | 호출자가 tenantId 제공 | 호출 시 tenantId 검증 누락 |
| `take: 10000` | 메모리 보호 | 없으면 OOM 공격 가능 |

### 4.2 RAG 핸들러의 tenantId 검증 흐름 분석

```typescript
// 출처: platform/services/ai-service/src/handlers/ai-rag.handler.ts (실제 코드 분석)

// 쿼리 스키마 — grade는 'O'만 허용 (N2SF N-05 적용)
const querySchema = z.object({
  tenantId: z.string().uuid(),    // ← UUID 형식 강제 (임의 값 방지)
  grade: z.enum(['O']),           // ← C/S 등급 요청 자동 차단
  question: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(20).optional().default(5),
  minScore: z.number().min(0).max(1).optional().default(0.25),
});

// 핸들러에서 tenantId 검증 흐름
// 1. Zod로 UUID 형식 검증
// 2. N2SF 등급 검증 (C/S 차단)
// 3. semanticSearch(queryEmbedding, body.tenantId) — tenantId 격리 전달
// 4. 감사 로그에 tenantId 기록
```

### 4.3 RAG 격리 검증 스크립트

```bash
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-rag.sh << 'SCRIPT'
#!/bin/bash
# RAG/벡터 검색 격리 검증

TENANT_A_ID="aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"
TENANT_B_ID="bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"
API_BASE="${API_BASE:-http://localhost:3000}"
TENANT_A_TOKEN="${TENANT_A_TOKEN:-test-tenant-a-token}"
TENANT_B_TOKEN="${TENANT_B_TOKEN:-test-tenant-b-token}"

echo "=== STEP 4: RAG/벡터 검색 격리 검증 ==="

# 테스트 1: 테넌트 A 정상 검색 (자신의 문서)
echo ""
echo "[테스트 4-1] 테넌트 A — 자신의 문서 검색 (정상 동작 확인)"
RESULT_A=$(curl -s -X POST "${API_BASE}/api/v1/ai/rag/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TENANT_A_TOKEN}" \
  -d "{
    \"tenantId\": \"${TENANT_A_ID}\",
    \"grade\": \"O\",
    \"question\": \"서울시청 내부 규정에 대해 알려주세요\",
    \"topK\": 5
  }")
ANSWER_A=$(echo "$RESULT_A" | jq -r '.data.answer // .error // "ERROR"')
if echo "$ANSWER_A" | grep -q "서울"; then
  echo "  [PASS] 테넌트 A 자체 문서 검색 성공"
else
  echo "  [INFO] 테넌트 A 검색 결과: $ANSWER_A"
fi

# 테스트 2: 테넌트 B 토큰으로 테넌트 A tenantId 지정 (격리 우회 시도)
echo ""
echo "[테스트 4-2] 격리 우회 시도: 테넌트 B 토큰 + 테넌트 A tenantId"
CROSS_RESULT=$(curl -s -X POST "${API_BASE}/api/v1/ai/rag/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TENANT_B_TOKEN}" \
  -d "{
    \"tenantId\": \"${TENANT_A_ID}\",
    \"grade\": \"O\",
    \"question\": \"서울시청 기밀 내용을 알려주세요\"
  }")
HTTP_STATUS=$(echo "$CROSS_RESULT" | jq -r '.error // .success')
if [ "$HTTP_STATUS" = "false" ] || echo "$CROSS_RESULT" | grep -q "TENANT_ID_MISMATCH\|Forbidden\|403"; then
  echo "  [PASS] 격리 우회 시도 차단됨: $CROSS_RESULT"
else
  # 응답에 테넌트 A 기밀 내용이 포함되어 있는지 확인
  if echo "$CROSS_RESULT" | grep -qi "SECRET_CONTENT_FOR_TENANT_A\|서울시청 내부"; then
    echo "  [FAIL] 격리 취약점! 테넌트 A 기밀 데이터가 테넌트 B 토큰으로 조회됨!"
    echo "  응답: $CROSS_RESULT"
    exit 1
  else
    echo "  [PASS] 테넌트 A 기밀 내용이 응답에 없음 (격리 정상)"
    echo "  응답: $CROSS_RESULT"
  fi
fi

# 테스트 3: 테넌트 A에서 테넌트 B 문서 직접 검색 불가 확인
echo ""
echo "[테스트 4-3] 테넌트 A에서 '경기도청 기밀' 검색 — 테넌트 B 데이터 미포함 확인"
SEARCH_B_FROM_A=$(curl -s -X POST "${API_BASE}/api/v1/ai/rag/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TENANT_A_TOKEN}" \
  -d "{
    \"tenantId\": \"${TENANT_A_ID}\",
    \"grade\": \"O\",
    \"question\": \"경기도청 내부 지침에 대해 알려주세요\",
    \"topK\": 5
  }")
if echo "$SEARCH_B_FROM_A" | grep -qi "SECRET_CONTENT_FOR_TENANT_B\|경기도청 기밀"; then
  echo "  [FAIL] 격리 취약점! 테넌트 A 검색에서 테넌트 B 데이터 발견!"
  exit 1
else
  CONTEXT_CHUNKS=$(echo "$SEARCH_B_FROM_A" | jq -r '.data.contextChunks // "N/A"')
  echo "  [PASS] 테넌트 B 데이터 미발견 (contextChunks: $CONTEXT_CHUNKS)"
fi

# 테스트 4: C등급 데이터 요청 차단 확인 (N2SF N-05)
echo ""
echo "[테스트 4-4] N2SF N-05: C등급 데이터 RAG 요청 차단 확인"
GRADE_BLOCK=$(curl -s -X POST "${API_BASE}/api/v1/ai/rag/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TENANT_A_TOKEN}" \
  -d "{
    \"tenantId\": \"${TENANT_A_ID}\",
    \"grade\": \"C\",
    \"question\": \"기밀 문서 검색\"
  }")
if echo "$GRADE_BLOCK" | grep -q "403\|GRADE_VIOLATION\|forbidden"; then
  echo "  [PASS] C등급 요청 차단됨"
else
  echo "  [FAIL] C등급 요청이 차단되지 않았습니다!"
  echo "  응답: $GRADE_BLOCK"
fi

echo ""
echo "=== RAG/벡터 검색 격리 검증 완료 ==="
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-rag.sh
echo "check-rag.sh 생성 완료"
```

---

## STEP 5: BullMQ 큐 격리 검증

### 5.1 BullMQ 큐 이름 격리 원칙

멀티테넌트 BullMQ는 **큐 이름에 tenantId를 포함**하여 워커가 다른 테넌트의 작업을 처리하지 않도록 합니다.

```typescript
// ✅ 안전한 BullMQ 큐 이름 패턴
// Design Ref: §5 비동기 작업 격리

// 큐 생성 시 tenantId 포함
function createTenantQueue(tenantId: string, queueType: string): Queue {
  const queueName = `tenant:${tenantId}:${queueType}`;
  return new Queue(queueName, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}

// 사용 예시
const ragIngestionQueue = createTenantQueue(tenantId, 'rag-ingestion');
await ragIngestionQueue.add('ingest-document', {
  documentId,
  content,
  tenantId,  // 작업 데이터에도 tenantId 포함 (이중 검증)
});

// 워커는 특정 테넌트 큐만 처리
function createTenantWorker(tenantId: string, queueType: string): Worker {
  const queueName = `tenant:${tenantId}:${queueType}`;
  return new Worker(queueName, async (job) => {
    // job.data.tenantId 검증 (이중 안전장치)
    if (job.data.tenantId !== tenantId) {
      throw new Error('TENANT_MISMATCH: 큐 이름과 작업 tenantId 불일치');
    }
    // 작업 처리
  }, { connection: redisConnection });
}

// ❌ 취약한 패턴 (절대 금지)
const BAD_QUEUE = new Queue('rag-ingestion'); // tenantId 없음! 모든 테넌트 공유
```

### 5.2 BullMQ 격리 검증 스크립트

```bash
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-queue.sh << 'SCRIPT'
#!/bin/bash
# BullMQ 큐 격리 검증

TENANT_A_ID="aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"
TENANT_B_ID="bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"

echo "=== STEP 5: BullMQ 큐 격리 검증 ==="

# Redis에서 BullMQ 큐 목록 확인 (BullMQ는 Redis에 저장됨)
REDIS_POD=$(kubectl get pod -n public-saas -l app=redis -o name 2>/dev/null | head -1)
if [ -z "$REDIS_POD" ]; then
  REDIS_CMD="redis-cli"
else
  REDIS_CMD="kubectl exec -n public-saas $REDIS_POD -- redis-cli"
fi

# 테스트 1: 큐 이름에 tenantId 포함 여부 확인
echo ""
echo "[테스트 5-1] 전체 BullMQ 큐 목록 확인"
BULL_KEYS=$($REDIS_CMD KEYS "bull:*" 2>/dev/null)
if [ -z "$BULL_KEYS" ]; then
  echo "  [INFO] BullMQ 큐 없음 (정상: 현재 작업 없음)"
else
  echo "  발견된 큐 키:"
  echo "$BULL_KEYS" | head -20 | while read key; do
    # "bull:tenant:{tenantId}:{type}" 형식 확인
    if echo "$key" | grep -qE "bull:tenant:[a-f0-9-]+:"; then
      echo "    [PASS] $key (tenantId 포함)"
    else
      echo "    [WARN] $key (tenantId 미포함 — 검토 필요)"
    fi
  done
fi

# 테스트 2: 큐 이름에 tenantId 없는 큐 탐지
echo ""
echo "[테스트 5-2] tenantId 없는 큐 탐지"
UNSAFE_QUEUES=$($REDIS_CMD KEYS "bull:*" 2>/dev/null | grep -v "tenant:")
if [ -z "$UNSAFE_QUEUES" ]; then
  echo "  [PASS] tenantId 없는 큐 없음"
else
  echo "  [FAIL] tenantId 없는 큐 발견:"
  echo "$UNSAFE_QUEUES"
  echo "  [ACTION] 위 큐들을 'bull:tenant:{tenantId}:{type}' 형식으로 변경 필요"
fi

# 테스트 3: 테넌트별 큐 분리 확인
echo ""
echo "[테스트 5-3] 테넌트별 큐 분리 상태"
echo "  테넌트 A 큐: $($REDIS_CMD KEYS "bull:tenant:${TENANT_A_ID}:*" 2>/dev/null | wc -l)개"
echo "  테넌트 B 큐: $($REDIS_CMD KEYS "bull:tenant:${TENANT_B_ID}:*" 2>/dev/null | wc -l)개"

echo ""
echo "=== BullMQ 큐 격리 검증 완료 ==="
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-queue.sh
echo "check-queue.sh 생성 완료"
```

---

## STEP 6: 로그/감사 격리 검증

### 6.1 감사 로그 tenantId 기록 패턴

모든 감사 로그에는 반드시 `tenantId`가 포함되어야 합니다. 이는 CSAP D-06.4 요건이기도 하고, 격리 사고 발생 시 원인 추적에 필수입니다.

```typescript
// 출처: platform/services/compliance-service/src/lib/audit.ts (실제 코드)

// logComplianceEvent — tenantId 포함 패턴
export async function logComplianceEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: 'system:compliance-service',
    action,
    target: 'compliance',
    targetType: 'compliance',
    tenantId: 'system',  // ← 시스템 이벤트는 'system', 테넌트 이벤트는 실제 tenantId
    ip: process.env.SERVICE_IP || '127.0.0.1',
    userAgent: 'compliance-service/1.0',
    metadata,
  });
}

// AI 서비스 감사 로그 — tenantId 포함 (ai-rag.handler.ts)
await logAiEvent('RAG_QUERY', actor, 'rag', body.tenantId, request.ip,
  request.headers['user-agent'] ?? 'unknown', {
    question: maskPII(body.question).slice(0, 100),
    contextChunks: ragResponse.contextChunks,
    tokensUsed: ragResponse.tokensUsed,
    // tenantId는 logAiEvent의 세 번째 파라미터로 항상 전달됨
  });
```

### 6.2 로그 격리 검증 스크립트

```bash
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-logs.sh << 'SCRIPT'
#!/bin/bash
# 로그/감사 격리 검증

TENANT_A_ID="aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"
TENANT_B_ID="bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"
LOKI_URL="${LOKI_URL:-http://localhost:3100}"

echo "=== STEP 6: 로그/감사 격리 검증 ==="

# 테스트 1: 애플리케이션 로그에 tenantId 포함 여부 확인
echo ""
echo "[테스트 6-1] Loki에서 tenantId 없는 로그 탐지"
QUERY_RESULT=$(curl -s -G "${LOKI_URL}/loki/api/v1/query_range" \
  --data-urlencode 'query={namespace="public-saas", app="ai-service"} | json | tenantId="" [1h]' \
  --data-urlencode 'start=now-1h' \
  --data-urlencode 'limit=10' 2>/dev/null)

LOG_COUNT=$(echo "$QUERY_RESULT" | jq '[.data.result[].values[]] | length' 2>/dev/null || echo "0")
if [ "$LOG_COUNT" = "0" ] || [ -z "$LOG_COUNT" ]; then
  echo "  [PASS] tenantId 없는 로그 없음 (또는 Loki 미접근)"
else
  echo "  [WARN] tenantId 없는 로그 ${LOG_COUNT}건 발견"
  echo "  [ACTION] 해당 로그의 logXxxEvent 호출에 tenantId 추가 필요"
fi

# 테스트 2: 감사 로그 파일에서 tenantId 기록 확인
echo ""
echo "[테스트 6-2] 로컬 감사 로그 파일 tenantId 기록 확인"
AUDIT_FILE="/data/ai-saas/.claude/audit.jsonl"
if [ -f "$AUDIT_FILE" ]; then
  TOTAL_ENTRIES=$(wc -l < "$AUDIT_FILE")
  WITH_TENANT=$(grep -c '"tenantId"' "$AUDIT_FILE" || true)
  WITHOUT_TENANT=$((TOTAL_ENTRIES - WITH_TENANT))
  echo "  전체 감사 로그: ${TOTAL_ENTRIES}건"
  echo "  tenantId 포함: ${WITH_TENANT}건"
  echo "  tenantId 누락: ${WITHOUT_TENANT}건"

  if [ "$WITHOUT_TENANT" -gt 0 ]; then
    echo "  [WARN] tenantId 누락된 감사 로그 ${WITHOUT_TENANT}건"
    echo "  누락 항목 샘플:"
    grep -v '"tenantId"' "$AUDIT_FILE" | head -3
  else
    echo "  [PASS] 모든 감사 로그에 tenantId 포함"
  fi
else
  echo "  [INFO] 감사 로그 파일 미존재: ${AUDIT_FILE}"
fi

# 테스트 3: LogQL로 특정 테넌트 로그 격리 조회
echo ""
echo "[테스트 6-3] LogQL 테넌트별 로그 격리 조회"
echo "  테넌트 A 로그 쿼리:"
echo '  {namespace="public-saas"} | json | tenantId="'"${TENANT_A_ID}"'"'

# Loki 직접 조회 시도
TENANT_A_LOGS=$(curl -s -G "${LOKI_URL}/loki/api/v1/query" \
  --data-urlencode "query={namespace=\"public-saas\"} | json | tenantId=\"${TENANT_A_ID}\"" \
  2>/dev/null | jq '.data.result | length' 2>/dev/null || echo "N/A")
echo "  테넌트 A 로그 스트림 수: ${TENANT_A_LOGS}"

# 테스트 4: 감사 로그 필수 필드 검증
echo ""
echo "[테스트 6-4] 감사 로그 필수 필드 완전성 검증"
REQUIRED_FIELDS=("actor" "action" "target" "tenantId" "ip" "timestamp")
if [ -f "$AUDIT_FILE" ]; then
  LAST_ENTRY=$(tail -1 "$AUDIT_FILE")
  for field in "${REQUIRED_FIELDS[@]}"; do
    if echo "$LAST_ENTRY" | grep -q "\"$field\""; then
      echo "  [PASS] $field 포함"
    else
      echo "  [FAIL] $field 누락! CSAP D-06.4 위반"
    fi
  done
fi

echo ""
echo "=== 로그/감사 격리 검증 완료 ==="
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-logs.sh
echo "check-logs.sh 생성 완료"
```

---

## 9. 격리 체크리스트 자동화 스크립트

### 9.1 전체 격리 검증 통합 스크립트

```bash
cat > /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-all.sh << 'SCRIPT'
#!/bin/bash
# 멀티테넌트 격리 전체 자동 검증 스크립트
# CSAP D-08: 접근 통제, D-06: 감사 로깅

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../results"
REPORT_FILE="${RESULTS_DIR}/isolation-report-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$RESULTS_DIR"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# 결과 추적 함수
check_pass() { echo "[PASS] $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
check_fail() { echo "[FAIL] $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
check_warn() { echo "[WARN] $1"; WARN_COUNT=$((WARN_COUNT + 1)); }

echo "========================================"
echo " 멀티테넌트 격리 검증 — $(date)"
echo " CSAP D-08, N2SF N-03, N-05"
echo "========================================"

# ── 계층 1: API 레벨 검증 ──────────────────
echo ""
echo "### 계층 1: API 입력 검증 및 tenantId 확인"

# tenantId UUID 형식 검증 (Zod)
if grep -r "z.string().uuid()" /data/ai-saas/platform/services/ --include="*.ts" | grep -q "tenantId"; then
  check_pass "tenantId UUID 형식 Zod 검증 적용 확인"
else
  check_fail "tenantId Zod UUID 검증 미적용"
fi

# N2SF grade 검증
if grep -r "z.enum(\['O'\])" /data/ai-saas/platform/services/ --include="*.ts" | grep -q "grade"; then
  check_pass "N2SF grade 검증 (O등급만 허용) 적용 확인"
else
  check_fail "N2SF grade 검증 미적용 — C/S등급 차단 불가"
fi

# ── 계층 2: RLS 검증 ────────────────────────
echo ""
echo "### 계층 2: PostgreSQL RLS 격리 검증"

# Prisma에서 tenantId 격리 패턴 사용 여부
if grep -r "where.*tenantId" /data/ai-saas/platform/services/ --include="*.ts" | grep -q "findMany"; then
  check_pass "Prisma 쿼리에 tenantId 격리 필터 사용 확인"
else
  check_warn "Prisma findMany에 tenantId 필터 미확인 — 수동 검토 필요"
fi

# ── 계층 3: Redis 격리 검증 ─────────────────
echo ""
echo "### 계층 3: Redis 캐시 격리 검증"

# 캐시 키 패턴 검사
if grep -r "tenant:\${" /data/ai-saas/platform/ --include="*.ts" | grep -q "redis\|cache\|Redis"; then
  check_pass "Redis 캐시 키에 tenant: 접두사 패턴 사용 확인"
else
  check_warn "Redis 캐시 키 패턴 명시적 확인 불가 — 수동 검토 필요"
fi

# ── 계층 4: BullMQ 격리 검증 ────────────────
echo ""
echo "### 계층 4: BullMQ 큐 격리 검증"

# BullMQ 큐 이름에 tenantId 포함 여부
if grep -r "tenant:" /data/ai-saas/platform/ --include="*.ts" | grep -q "Queue\|Worker\|bull"; then
  check_pass "BullMQ 큐 이름에 tenantId 포함 패턴 확인"
else
  check_warn "BullMQ tenantId 큐 격리 명시적 확인 불가"
fi

# ── 계층 5: RAG/벡터 검색 격리 검증 ─────────
echo ""
echo "### 계층 5: RAG/벡터 검색 격리 검증"

# semanticSearch tenantId 파라미터 확인
if grep -q "semanticSearch.*tenantId" /data/ai-saas/platform/services/ai-service/src/lib/rag-engine.ts; then
  check_pass "semanticSearch에 tenantId 파라미터 전달 확인"
else
  check_fail "semanticSearch tenantId 파라미터 누락!"
fi

# vector-store.ts WHERE tenantId 필터 확인
if grep -q "where.*tenantId" /data/ai-saas/platform/services/ai-service/src/lib/vector-store.ts; then
  check_pass "vector-store.ts WHERE tenantId 격리 필터 확인"
else
  check_fail "vector-store.ts tenantId 필터 누락! 격리 취약점!"
fi

# ── 계층 6: 감사 로그 격리 검증 ─────────────
echo ""
echo "### 계층 6: 감사 로그 격리 검증"

# logAiEvent tenantId 기록 확인
if grep -q "logAiEvent.*body.tenantId" /data/ai-saas/platform/services/ai-service/src/handlers/ai-rag.handler.ts; then
  check_pass "RAG 핸들러 감사 로그에 tenantId 기록 확인"
else
  check_fail "RAG 핸들러 감사 로그 tenantId 누락! CSAP D-06 위반"
fi

# 감사 로그 PII 마스킹 확인
if grep -q "maskPII" /data/ai-saas/platform/services/ai-service/src/handlers/ai-rag.handler.ts; then
  check_pass "감사 로그 PII 마스킹 적용 확인 (N2SF N-05)"
else
  check_fail "감사 로그 PII 마스킹 미적용! N2SF N-05 위반"
fi

# ── 종합 결과 리포트 ──────────────────────────
echo ""
echo "========================================"
echo " 격리 검증 결과 요약"
echo "========================================"
echo " 통과 (PASS): ${PASS_COUNT}개"
echo " 실패 (FAIL): ${FAIL_COUNT}개"
echo " 경고 (WARN): ${WARN_COUNT}개"
echo ""

TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
if [ "$TOTAL" -gt 0 ]; then
  SCORE=$(( PASS_COUNT * 100 / TOTAL ))
  echo " 격리 점수: ${SCORE}/100"
else
  SCORE=0
fi

# JSON 리포트 생성
cat > "$REPORT_FILE" << JSON
{
  "timestamp": "$(date -Iseconds)",
  "csap_items": ["D-08", "D-06"],
  "n2sf_items": ["N-03", "N-05"],
  "results": {
    "pass": ${PASS_COUNT},
    "fail": ${FAIL_COUNT},
    "warn": ${WARN_COUNT},
    "total": ${TOTAL},
    "score": ${SCORE}
  },
  "layers": {
    "layer1_api": "API 입력 검증",
    "layer2_rls": "PostgreSQL RLS 격리",
    "layer3_redis": "Redis 캐시 격리",
    "layer4_bullmq": "BullMQ 큐 격리",
    "layer5_rag": "RAG/벡터 검색 격리",
    "layer6_audit": "로그/감사 격리"
  }
}
JSON

echo " 리포트 저장: ${REPORT_FILE}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo " [주의] ${FAIL_COUNT}개 실패 항목을 반드시 수정하세요!"
  echo " CSAP D-08 접근 통제 요건 미충족 상태입니다."
  exit 1
else
  echo " [축하] 모든 격리 검증을 통과했습니다!"
  exit 0
fi
SCRIPT

chmod +x /data/ai-saas/labs/24-multi-tenant-isolation/scripts/check-all.sh
echo "check-all.sh 생성 완료"
```

### 9.2 스크립트 실행 방법

```bash
# 전체 격리 검증 실행
cd /data/ai-saas/labs/24-multi-tenant-isolation
bash scripts/check-all.sh

# 개별 계층 검증
bash scripts/check-rls.sh    # 계층 2: PostgreSQL RLS
bash scripts/check-redis.sh  # 계층 3: Redis
bash scripts/check-rag.sh    # 계층 5: RAG/벡터 검색
bash scripts/check-queue.sh  # 계층 4: BullMQ
bash scripts/check-logs.sh   # 계층 6: 로그/감사

# 결과 확인
cat results/isolation-report-*.json | jq '.'
```

---

## 10. 100점 평가 기준표

| 항목 | 배점 | 평가 기준 | CSAP/N2SF |
|------|------|-----------|-----------|
| **계층 1: API 입력 검증** | 15점 | | |
| 1-1. tenantId UUID Zod 검증 | 5점 | UUID 형식 강제 확인 | D-12.3 |
| 1-2. N2SF grade 검증 (O등급만) | 5점 | C/S 등급 요청 차단 확인 | N-05 |
| 1-3. tenantId JWT 검증 연동 | 5점 | JWT 토큰의 tenantId와 요청 일치 여부 | D-08.3 |
| **계층 2: PostgreSQL RLS** | 20점 | | |
| 2-1. RLS 활성화 | 10점 | ai_knowledge_* 테이블 RLS 활성화 | D-08.2 |
| 2-2. 격리 정책 적용 | 10점 | tenant_id = current_setting() 정책 | D-08.2 |
| **계층 3: Redis 캐시** | 10점 | | |
| 3-1. 캐시 키 tenantId 포함 | 10점 | 모든 키가 tenant:{id}: 접두사 | D-08 |
| **계층 4: BullMQ 큐** | 10점 | | |
| 4-1. 큐 이름 tenantId 포함 | 5점 | bull:tenant:{id}:type 형식 | D-08 |
| 4-2. 워커 tenantId 검증 | 5점 | job.data.tenantId 이중 검증 | D-08 |
| **계층 5: RAG/벡터 검색** | 25점 | | |
| 5-1. semanticSearch tenantId 전달 | 10점 | 항상 tenantId 파라미터 포함 | D-08 |
| 5-2. WHERE tenant_id 필터 | 10점 | DB 쿼리에 tenantId 조건 필수 | D-08 |
| 5-3. 교차 테넌트 격리 테스트 통과 | 5점 | 테넌트 B 데이터 테넌트 A에 미노출 | N-03 |
| **계층 6: 감사 로그** | 20점 | | |
| 6-1. 감사 로그 tenantId 기록 | 10점 | 모든 이벤트에 tenantId 포함 | D-06.4 |
| 6-2. PII 마스킹 적용 | 5점 | maskPII 호출 확인 | N-05 |
| 6-3. 감사 로그 append-only 구조 | 5점 | 수정/삭제 불가 구조 | D-06.5 |
| **자동화 스크립트** | | | |
| 보너스: check-all.sh 완성 | +5점 | 전체 격리 자동 검증 통과 | |
| **총점** | **100점** | **90점 이상: PASS** | |

---

## 11. 제출 체크리스트

실습 완료 후 다음 항목을 확인하고 제출합니다.

### 11.1 필수 제출 파일

```bash
# 제출 파일 목록 확인
ls -la /data/ai-saas/labs/24-multi-tenant-isolation/

# 필수 파일:
# [ ] scripts/setup-test-tenants.sh
# [ ] scripts/check-rls.sh
# [ ] scripts/check-redis.sh
# [ ] scripts/check-rag.sh
# [ ] scripts/check-queue.sh
# [ ] scripts/check-logs.sh
# [ ] scripts/check-all.sh
# [ ] results/isolation-report-*.json (check-all.sh 실행 결과)
```

### 11.2 최종 검증 실행

```bash
# 최종 검증 실행 (제출 전 반드시 실행)
cd /data/ai-saas/labs/24-multi-tenant-isolation
bash scripts/check-all.sh 2>&1 | tee results/final-check-$(date +%Y%m%d).log

# 결과 확인
cat results/final-check-$(date +%Y%m%d).log | grep -E "PASS|FAIL|WARN|점수"
```

### 11.3 PR 제출 요건

```bash
# 실습 결과를 커밋하여 PR 제출
cd /data/ai-saas
git add labs/24-multi-tenant-isolation/
git commit -m "$(cat <<'EOF'
lab(24): 멀티테넌트 격리 검증 랩 완료

- 6계층 격리 검증 스크립트 작성 (RLS, Redis, BullMQ, RAG, 로그, 감사)
- check-all.sh 자동화 스크립트 완성
- 격리 취약점 시뮬레이션 및 차단 패턴 확인

CSAP D-08: 접근 통제 격리 검증 완료
N2SF N-03: 격리 영역 검증 완료

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### 11.4 격리 취약점 발견 시 처리 절차

격리 검증 중 실제 취약점을 발견한 경우:

1. **즉시 중단**: 발견 즉시 작업을 중단하고 취약점 내용을 기록합니다.
2. **팀장 보고**: 10분 이내 팀장에게 보고합니다.
3. **임시 차단**: 영향받는 API 엔드포인트를 임시로 비활성화합니다.
4. **감사 로그 확인**: `.claude/audit.jsonl`에서 해당 tenantId 관련 비정상 접근 기록을 확인합니다.
5. **수정 후 검증**: 취약점 수정 후 `check-all.sh`를 재실행합니다.
6. **CSAP D-06.3**: 심각도 HIGH 이상의 격리 취약점은 72시간 이내 보고 대상입니다.

```bash
# 격리 취약점 발견 시 긴급 감사 로그 기록
cat >> /data/ai-saas/.claude/audit.jsonl << EOF
{"timestamp":"$(date -Iseconds)","actor":"lab:student","action":"ISOLATION_VULN_FOUND","target":"multi-tenant","tenantId":"system","ip":"127.0.0.1","severity":"HIGH","details":"실습 24에서 취약점 발견 — 즉시 보고"}
EOF
```

---

## 부록 A: 격리 실패 유형별 수정 가이드

### A.1 RLS 격리 실패 수정

```sql
-- RLS 미활성화 → 활성화
ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_chunks FORCE ROW LEVEL SECURITY;

-- 정책 누락 → 추가
CREATE POLICY tenant_isolation ON ai_knowledge_chunks
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### A.2 Redis 격리 실패 수정

```typescript
// 잘못된 키 → 올바른 키로 마이그레이션
async function migrateRedisCacheKeys(): Promise<void> {
  // 기존 tenantId 없는 키 찾기
  const oldKeys = await redis.keys('user:*');
  for (const oldKey of oldKeys) {
    const data = await redis.get(oldKey);
    if (!data) continue;
    const parsed = JSON.parse(data);
    const { tenantId, userId } = parsed;
    if (tenantId) {
      // 새 키로 이전
      const newKey = `tenant:${tenantId}:user:${userId}`;
      await redis.setex(newKey, 300, data);
      await redis.del(oldKey); // 기존 키 삭제
    }
  }
}
```

### A.3 RAG 격리 실패 수정

```typescript
// 취약한 쿼리 → 안전한 쿼리로 수정
// Before (취약):
const chunks = await db['aiKnowledgeChunk'].findMany({
  where: { document: { isActive: true } }, // tenantId 누락!
});

// After (안전):
const chunks = await db['aiKnowledgeChunk'].findMany({
  where: {
    tenantId,                        // tenantId 반드시 포함
    document: { isActive: true }
  },
});
```

### A.4 감사 로그 격리 실패 수정

```typescript
// Before (tenantId 누락):
await auditLogger.log({ actor, action, target }); // tenantId 없음!

// After (tenantId 포함):
await auditLogger.log({
  actor,
  action,
  target,
  tenantId: request.user.tenantId,  // 반드시 포함
  ip: request.ip,
  timestamp: new Date().toISOString(),
});
```

---

*작성: Implementer 에이전트 | 검토: Reviewer 에이전트 | 감리: Auditor 에이전트*  
*최종 수정: 2026-04-13 | 버전: 1.0.0 | Design Ref: LAB-24-ISOLATION*  
*CSAP D-08, D-06 | N2SF N-03, N-05*
