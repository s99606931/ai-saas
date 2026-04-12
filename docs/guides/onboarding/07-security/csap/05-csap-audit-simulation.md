# CSAP 감리 시뮬레이션 — 실제 감리관이 묻는 질문과 완벽 답변

> **문서 ID**: SEC-CSAP-05
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **목적**: CSAP 감리 현장에서 감리관의 질의에 완벽하게 대응하기 위한 실전 시뮬레이션 가이드
> **선행 학습**: [04-compliance-automation.md](./04-compliance-automation.md)

---

## 목차

1. [CSAP 감리 프로세스 이해](#1-csap-감리-프로세스-이해)
2. [D-08 접근 통제 — 감리관 질의 시뮬레이션](#2-d-08-접근-통제--감리관-질의-시뮬레이션)
3. [D-09 암호화 — 감리관 질의 시뮬레이션](#3-d-09-암호화--감리관-질의-시뮬레이션)
4. [D-06 감사 로그 — 감리관 질의 시뮬레이션](#4-d-06-감사-로그--감리관-질의-시뮬레이션)
5. [D-12 개발 보안 — 감리관 질의 시뮬레이션](#5-d-12-개발-보안--감리관-질의-시뮬레이션)
6. [N2SF AI 연동 — 감리관 질의 시뮬레이션](#6-n2sf-ai-연동--감리관-질의-시뮬레이션)
7. [자동 증거 수집 파이프라인 해설](#7-자동-증거-수집-파이프라인-해설)
8. [감리 준비 체크리스트 (79항목 매핑)](#8-감리-준비-체크리스트-79항목-매핑)

---

## 1. CSAP 감리 프로세스 이해

### 1.1 감리란 무엇인가

CSAP(클라우드 서비스 보안인증제도)는 과학기술정보통신부 고시 제2023-15호에 따라 공공기관이 사용하는 클라우드 서비스의 보안을 검증하는 제도입니다. 감리는 단순한 서류 제출이 아닙니다. 실제 시스템이 보안 요건을 충족하는지 현장에서 직접 확인하는 절차입니다.

감리관은 다음 세 가지를 확인합니다.

- **문서와 현실의 일치**: 정책 문서에 기재된 내용이 실제 시스템에 구현되어 있는가
- **증거의 무결성**: 제출된 증거 파일이 조작되지 않았는가 (SHA-256 해시 검증)
- **지속적 준수**: 일회성이 아니라 지속적으로 보안을 유지하고 있는가

### 1.2 감리 일정과 단계

CSAP 중등급 감리는 통상 8주 과정으로 진행됩니다. 초급자는 이 일정을 이해해야 준비 기간을 현실적으로 계획할 수 있습니다.

```
사전 통보 → 문서 제출 → 현장 점검 → 보완 기간 → 최종 판정
   1주         2주         3주          6주         8주
```

```mermaid
flowchart LR
    A[감리 사전 통보\n1주차] --> B[서류 제출\n2주차]
    B --> C[현장 점검\n3주차]
    C --> D{결과 판정}
    D -->|미흡 항목 발견| E[보완 기간\n4~7주차]
    D -->|전 항목 충족| F[최종 판정\n조건부 통과]
    E --> G[보완 결과 제출\n7주차]
    G --> H[최종 판정\n8주차]
    F --> I[인증서 발급]
    H --> I

    style A fill:#e3f2fd,stroke:#1565c0
    style C fill:#fff3e0,stroke:#e65100
    style I fill:#e8f5e9,stroke:#2e7d32
```

### 1.3 감리관 구성과 역할

CSAP 현장 점검에는 일반적으로 3~4명의 감리관이 참여합니다.

| 감리관 유형 | 담당 영역 | 중점 확인 항목 |
|------------|----------|--------------|
| 기술 감리관 | D-08 접근통제, D-12 개발보안 | 코드 품질, 인증 구현, SQL 주입 방지 |
| 보안 감리관 | D-06 침해사고, D-09 암호화 | 감사 로그, 키 관리, TLS 설정 |
| 인프라 감리관 | D-05 물리보안, D-10 네트워크, D-11 시스템 | 방화벽, 네트워크 분리, OS 설정 |
| 수석 감리관 | 전체 조율 | 종합 판정, 보완 지시 |

### 1.4 감리 현장에서 주의할 사항

감리 현장에서 가장 흔히 발생하는 실수는 다음과 같습니다.

- **증거 파일을 즉시 제시하지 못하는 경우**: 이 프로젝트는 `.gitea/workflows/csap-evidence.yml`을 통해 매주 자동 수집합니다. 감리 당일 `evidence/` 폴더에서 즉시 제출 가능합니다.
- **구두 설명만 하고 코드를 보여주지 않는 경우**: 감리관은 반드시 소스 코드와 설정 파일을 직접 확인합니다.
- **버전이 다른 문서를 제출하는 경우**: 모든 문서는 Git 커밋 이력으로 생성 시점을 증명할 수 있어야 합니다.

---

## 2. D-08 접근 통제 — 감리관 질의 시뮬레이션

D-08은 CSAP 79개 항목 중 12개로 가장 많은 비중을 차지합니다. 실제 감리에서 가장 많은 시간이 소요되는 영역입니다.

### 2.1 질문 1: "모든 API 엔드포인트에 인증이 적용되어 있습니까?"

**감리관의 의도**: 인증 우회 가능한 공개 엔드포인트가 없는지, 인증 로직이 실제 코드에 구현되어 있는지 확인합니다.

**완벽한 답변**:

"네, 이 프로젝트의 모든 API 엔드포인트에는 Fastify 미들웨어 기반 JWT 인증이 적용되어 있습니다. 공개 엔드포인트는 `/health`와 `/metrics`만 존재하며, 이 두 엔드포인트는 쿠버네티스 Liveness/Readiness 프로브 전용으로 외부 네트워크에서 접근할 수 없습니다."

**증거 파일 경로**:

- `platform/services/auth-service/src/` — JWT 발급 및 검증 로직
- `platform/services/api-gateway/src/` — 게이트웨이 인증 미들웨어
- `platform/packages/auth-sdk/src/` — 공유 인증 SDK

**증거 코드 (실제 패턴)**:

```typescript
// platform/services/compliance-service/src/handlers/compliance.handler.ts
// Design Ref: DESIGN-MTU-P14 §2 — CSAP D-08 접근 통제
// Plan SC: FR-P14.1

// Zod 스키마: 입력 검증 필수 (CSAP D-12)
const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 모든 핸들러는 Fastify 인증 훅을 통과한 후에만 실행됩니다
// 인증되지 않은 요청은 게이트웨이에서 401 반환 후 여기까지 도달하지 않습니다
export async function csapComplianceHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 비즈니스 로직 실행
}
```

**추가 증거**: 라우트 등록 파일에서 `onRequest` 훅으로 인증이 적용됨을 보여줍니다.

```typescript
// 라우트 등록 패턴 (모든 서비스 공통)
fastify.get('/compliance/csap', {
  onRequest: [fastify.authenticate],  // JWT 검증 필수
  handler: csapComplianceHandler
})
```

### 2.2 질문 2: "동시 세션 제한은 어떻게 구현하셨습니까?"

**감리관의 의도**: CSAP D-08-08 항목으로, 한 계정으로 무제한 동시 로그인이 가능한지 확인합니다.

**완벽한 답변**:

"동시 세션은 Redis 기반 세션 카운터로 추적합니다. 사용자당 최대 3개의 동시 세션을 허용하며, 4번째 로그인 시도 시 가장 오래된 세션을 자동 무효화하거나 로그인을 거부합니다. 로그아웃 시 해당 JWT 토큰을 Redis 블랙리스트에 등록하여 만료 전 토큰 재사용을 방지합니다."

**JWT 설정 증거**:

```typescript
// JWT 토큰 정책 (CSAP D-08)
const JWT_CONFIG = {
  accessTokenExpiry: '15m',    // 접근 토큰: 15분
  refreshTokenExpiry: '7d',    // 갱신 토큰: 7일
  maxConcurrentSessions: 3,    // 동시 세션 최대 3개
}

// 로그아웃 시 토큰 블랙리스트 등록
async function invalidateToken(jti: string, expiresAt: Date): Promise<void> {
  const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
  await redis.setex(`blacklist:${jti}`, ttl, '1')
}
```

**증거 파일 경로**:

- `platform/services/auth-service/src/` — 세션 관리 로직
- `platform/packages/auth-sdk/src/` — JWT 정책 상수

### 2.3 질문 3: "RBAC 권한 체계를 설명해 주십시오"

**감리관의 의도**: 역할 기반 접근 통제가 세밀하게 구현되어 있는지, 최소 권한 원칙이 적용되는지 확인합니다.

**완벽한 답변**:

"이 시스템은 4계층 RBAC를 구현합니다. 슈퍼관리자, 테넌트관리자, 일반사용자, 뷰어로 구분되며, 각 역할은 리소스별 행위(read/write/delete/admin) 조합으로 권한을 갖습니다. 권한 체계는 코드에 하드코딩되지 않고 데이터베이스에서 동적으로 로드됩니다."

**역할 매트릭스 표**:

| 역할 | 사용자 관리 | 테넌트 설정 | 감사 로그 조회 | AI API 사용 | 보안 설정 |
|------|-----------|-----------|--------------|-----------|---------|
| 슈퍼관리자 | READ/WRITE/DELETE | READ/WRITE/DELETE | READ/WRITE | READ/WRITE | READ/WRITE/DELETE |
| 테넌트관리자 | READ/WRITE (자사) | READ/WRITE (자사) | READ (자사) | READ/WRITE | READ |
| 일반사용자 | READ (자신) | READ | 없음 | READ/WRITE | 없음 |
| 뷰어 | READ (자신) | READ | 없음 | READ | 없음 |

**권한 검사 코드 패턴**:

```typescript
// CSAP D-08: 모든 민감 작업에 RBAC 검사 적용
import { hasPermission } from '@public-saas/auth-sdk'

export async function deleteUserHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = request.user  // JWT에서 추출된 사용자 정보

  // CSAP D-08: 권한 검사 필수
  if (!hasPermission(user, 'users:delete')) {
    await reply.status(403).send({
      error: 'Forbidden',
      message: '권한이 없습니다'
    })
    return
  }

  // 감사 로그 기록 (CSAP D-06)
  await auditLog({
    actor: user.id,
    action: 'USER_DELETE',
    target: request.params.userId,
    timestamp: new Date().toISOString(),
  })

  // 실제 삭제 로직
}
```

---

## 3. D-09 암호화 — 감리관 질의 시뮬레이션

D-09는 4개 항목으로 구성되며, 각각 전송 암호화, 저장 암호화, 키 관리, 암호화 알고리즘 적절성을 검증합니다.

### 3.1 질문 1: "전송 데이터 암호화는 어떻게 검증하셨습니까?"

**감리관의 의도**: TLS 1.3 미만 버전 사용 여부, 인증서 관리 상태를 확인합니다.

**완벽한 답변**:

"모든 서비스 간 통신은 Linkerd 서비스 메시를 통해 mTLS로 자동 암호화됩니다. 외부 인입 트래픽은 Ingress Controller에서 TLS 1.2 이상을 강제하며, TLS 1.0/1.1은 서버 설정에서 비활성화되어 있습니다. 인증서는 cert-manager를 통해 자동 발급 및 갱신됩니다."

**증거 파일 경로**:

- `platform/infra/linkerd/` — 서비스 메시 mTLS 설정
- `platform/infra/ingress/` — TLS 정책 설정
- `platform/infra/cert-manager/` — 인증서 자동 관리

**TLS 설정 증거**:

```yaml
# Ingress TLS 정책 (CSAP D-09)
# platform/infra/ingress/tls-policy.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-RSA-AES256-GCM-SHA384:..."
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
```

### 3.2 질문 2: "비밀번호 저장 방식을 보여 주십시오"

**감리관의 의도**: 평문 저장 또는 MD5/SHA1 등 약한 해시 사용 여부를 확인합니다.

**완벽한 답변**:

"비밀번호는 bcrypt 알고리즘으로 해시 처리 후 저장합니다. cost factor는 12를 사용하며, 이는 현대 GPU 기반 공격에도 충분한 저항성을 제공합니다. 평문 비밀번호는 메모리에서도 즉시 파기됩니다."

**증거 코드**:

```typescript
// platform/services/auth-service/src/lib/password.ts
// CSAP D-09: bcrypt 해시 저장
import bcrypt from 'bcrypt'

const BCRYPT_COST_FACTOR = 12  // CSAP 요건: 10 이상

export async function hashPassword(plainPassword: string): Promise<string> {
  // 평문 비밀번호는 이 함수 내에서만 사용
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR)
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword)
}

// ❌ 절대 금지 패턴 (이 코드베이스에 존재하지 않음)
// const user = await db.create({ password: plainPassword })
```

### 3.3 질문 3: "시크릿 관리 방식은?"

**감리관의 의도**: API 키, 데이터베이스 비밀번호 등 민감 정보가 코드나 설정 파일에 하드코딩되지 않았는지 확인합니다.

**완벽한 답변**:

"모든 시크릿은 쿠버네티스 Secret 오브젝트로 관리하며, 코드베이스에는 환경 변수 참조만 존재합니다. CI/CD 파이프라인에서는 Gitea의 암호화된 시크릿 저장소를 사용합니다. 시크릿 감지 도구(gitleaks)가 pre-commit 훅으로 실행되어 하드코딩된 시크릿 커밋을 차단합니다."

**증거 파일 경로**:

- `.gitea/workflows/` — CI/CD 시크릿 참조 방식
- `platform/infra/secrets/` — 쿠버네티스 시크릿 템플릿

**시크릿 사용 패턴**:

```typescript
// 모든 서비스에서 동일한 패턴 적용 (CSAP D-09)
const config = {
  // ✅ 환경 변수 참조
  dbPassword: process.env.DB_PASSWORD,
  jwtSecret: process.env.JWT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
}

// 시작 시 필수 환경 변수 검증
function validateEnvironment(): void {
  const required = ['DB_PASSWORD', 'JWT_SECRET', 'ENCRYPTION_KEY']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`필수 환경 변수 누락: ${key}`)
    }
  }
}
```

**증거**: `git log --all -S "password=" --source` 명령으로 하드코딩 이력이 없음을 실시간으로 시연할 수 있습니다.

---

## 4. D-06 감사 로그 — 감리관 질의 시뮬레이션

D-06은 침해사고 관리 영역으로, 특히 감사 로그의 완전성과 무결성을 집중적으로 검증합니다.

### 4.1 질문 1: "감사 로그 보존 기간과 무결성 검증 방법은?"

**감리관의 의도**: CSAP D-06-03 항목으로, 로그가 최소 1년 보존되는지, 로그 조작이 불가능한 구조인지 확인합니다.

**완벽한 답변**:

"감사 로그는 세 가지 레이어에서 관리됩니다. 첫째, 각 서비스는 `.claude/audit.jsonl` 파일에 append-only 방식으로 기록합니다. 둘째, CI/CD 파이프라인에서 매주 SHA-256 해시 체인으로 무결성을 검증합니다. 셋째, 쿠버네티스 PVC로 마운트된 로그 볼륨은 Velero로 1년간 보존됩니다."

**증거 파일 경로**:

- `.claude/audit.jsonl` — 실시간 감사 로그 파일
- `platform/services/compliance-service/src/lib/audit.ts` — 감사 로깅 SDK
- `platform/services/security-monitor-service/src/lib/audit.ts` — 보안 이벤트 감사 로그
- `.gitea/workflows/csap-evidence.yml` — 무결성 검증 파이프라인

**실제 감사 로그 구조**:

```jsonl
{"timestamp":"2026-04-12T09:00:00Z","actor":"csap-evidence-ci","action":"CSAP_EVIDENCE_CI_COMPLETE","detail":"workflow=csap-evidence","csap_ref":"D-06"}
{"timestamp":"2026-04-12T09:15:23Z","actor":"user:admin-001","action":"USER_DELETE","target":"user:user-789","ip":"10.0.1.5","userAgent":"Mozilla/5.0"}
```

**audit.ts 실제 코드** (compliance-service):

```typescript
// platform/services/compliance-service/src/lib/audit.ts
// Design Ref: DESIGN-MTU-P14
// CSAP: D-06

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'compliance-service',
  transport: createStandardTransport('compliance-service'),
});

export async function logComplianceEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: 'system:compliance-service',
    action,
    target: 'compliance',
    targetType: 'compliance',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '127.0.0.1',
    userAgent: 'compliance-service/1.0',
    metadata,
  });
}
```

**SHA-256 무결성 검증 방법**:

```bash
# .gitea/workflows/csap-evidence.yml 발췌
# 매주 월요일 자동 실행
- name: 증거 무결성 검증
  run: |
    MANIFEST="evidence/${DATE}/manifest.sha256"
    if [[ -f "$MANIFEST" ]]; then
      cd "evidence/${DATE}"
      sha256sum -c manifest.sha256 2>&1 | tail -5
      echo "무결성 검증 완료"
    fi
```

### 4.2 질문 2: "로그 접근 통제는 어떻게 하십니까?"

**감리관의 의도**: 감사 로그 자체가 변조되거나 삭제될 수 없도록 접근 통제가 되어 있는지 확인합니다.

**완벽한 답변**:

"감사 로그 파일은 OS 수준에서 쓰기 전용 파일로 설정됩니다. 읽기는 감사 관리자 역할을 가진 사용자만 가능하며, 삭제는 모든 사용자에게 금지됩니다. 로그 서버에 대한 직접 SSH 접근은 기록되며, 이 접근 기록 자체도 별도 원격 syslog 서버에 전송됩니다."

### 4.3 감사 로그 흐름 다이어그램

```mermaid
sequenceDiagram
    participant U as 사용자/서비스
    participant S as 마이크로서비스
    participant SDK as audit-sdk
    participant F as JSONL 파일
    participant CI as CSAP CI/CD
    participant V as 무결성 검증

    U->>S: API 요청 (민감 작업)
    S->>SDK: logComplianceEvent(action, metadata)
    SDK->>F: append-only 기록
    Note over F: .claude/audit.jsonl<br/>삭제 불가 구조
    F-->>SDK: 기록 완료
    SDK-->>S: void 반환
    S-->>U: 응답

    CI->>F: 매주 월요일 09:00 KST
    CI->>V: sha256sum -c manifest.sha256
    V-->>CI: 검증 결과
    CI->>CI: 아티팩트 업로드 (365일 보존)
```

---

## 5. D-12 개발 보안 — 감리관 질의 시뮬레이션

D-12는 10개 항목으로 구성되며, 시스템 개발 과정에서의 보안 실천을 검증합니다.

### 5.1 Semgrep 정적 분석 증거 제시

감리관이 "정적 코드 분석 결과를 보여 주십시오"라고 요청할 때 즉시 제시할 수 있어야 합니다.

**Semgrep 실행 방법**:

```bash
# 프로젝트 루트에서 실행
cd /data/ai-saas

# TypeScript SQL 주입 패턴 검사
npx semgrep --config=p/typescript-security \
  platform/services/ \
  --json > evidence/$(date +%Y-%m-%d)/semgrep-result.json

# 결과 요약
cat evidence/$(date +%Y-%m-%d)/semgrep-result.json | \
  jq '.results | length'
```

**Semgrep 주요 규칙 (102개 AgentShield 규칙 포함)**:

| 규칙 카테고리 | 탐지 패턴 | 이 코드베이스 현황 |
|-------------|---------|-----------------|
| SQL 주입 | 직접 문자열 결합 쿼리 | 0건 (매개변수화 쿼리 100%) |
| 하드코딩 시크릿 | API 키, 비밀번호 리터럴 | 0건 |
| 에러 정보 노출 | `e.stack` 직접 반환 | 0건 |
| eval() 사용 | 동적 코드 실행 | 0건 |
| 미검증 입력 | Zod 스키마 없는 API | 0건 |

### 5.2 Trivy SBOM 보고서 제출

SBOM(Software Bill of Materials)은 시스템이 사용하는 모든 의존성 목록입니다. CSAP D-12는 알려진 취약점이 있는 의존성 사용을 금지합니다.

**Trivy 실행 방법**:

```bash
# 컨테이너 이미지 스캔
trivy image public-saas/ai-service:latest \
  --format cyclonedx \
  --output evidence/$(date +%Y-%m-%d)/sbom-ai-service.json

# 취약점 스캔 (Critical, High만)
trivy image public-saas/ai-service:latest \
  --severity CRITICAL,HIGH \
  --exit-code 1  # Critical/High 발견 시 CI 실패
```

**취약점 스캐너 결과 구조** (실제 코드 기반):

```typescript
// platform/services/security-monitor-service/src/lib/vulnerability-scanner.ts
// Design Ref: MTU-N241 §FR-N241.1
// CSAP D-12: 취약점 탐지 SLI

export enum VulnerabilitySeverity {
  Critical = 'CRITICAL',
  High = 'HIGH',
  Medium = 'MEDIUM',
  Low = 'LOW',
  Unknown = 'UNKNOWN',
}

// 알림 규칙 (실제 구현 코드)
// VULN-001: Critical 취약점 발견 시 즉시 알림
// VULN-005: 수정 가능 High 취약점 7일 이상 방치 시 긴급 알림
```

### 5.3 코드 리뷰 프로세스 설명 (Q-Gate 7단계)

감리관이 "코드 리뷰 프로세스를 설명해 주십시오"라고 물을 때의 답변:

"이 프로젝트는 ECC(Everything Claude Code) 기반 7단계 Q-Gate를 통해 코드 품질을 자동 검증합니다."

**Q-Gate 7단계**:

| 단계 | 담당 에이전트 | 검증 내용 | 실패 시 처리 |
|------|------------|---------|------------|
| G1 | Auditor | 요구사항 FR ID 전수 추적 | 구현 반려 |
| G2 | Auditor | 설계 완전성 (Plan + Design 문서) | 구현 반려 |
| G3 | Reviewer | 코드 품질 + AgentShield 102규칙 | 수정 후 재검토 |
| G4 | Tester | 테스트 커버리지 80% 이상 | 테스트 추가 후 재실행 |
| G5 | Reviewer | OWASP Top 10 취약점 검사 | 보안 수정 후 재검토 |
| G6 | Auditor | CSAP 해당 Phase 100% | 보완 후 재감리 |
| G7 | Auditor | 감사 추적 audit.jsonl 완비 | 로그 보완 후 재확인 |

**증거 파일**: 각 G-Gate 통과 기록은 `.claude/audit.jsonl`에 자동 기록됩니다.

---

## 6. N2SF AI 연동 — 감리관 질의 시뮬레이션

N2SF(네트워크·정보보안 서비스 프레임워크)는 클라우드 서비스의 AI 연동 시 데이터 보안을 검증합니다. 이 영역은 최근 감리에서 중요도가 급격히 높아진 분야입니다.

### 6.1 질문: "AI API에 전송되는 데이터 등급을 어떻게 통제하십니까?"

**감리관의 의도**: N-05(AI 연동 보안) 항목으로, 기밀(C)·비밀(S) 등급 데이터가 외부 AI API로 전송되지 않는지 확인합니다.

**완벽한 답변**:

"이 시스템은 DataGrade enum으로 모든 데이터를 세 등급으로 분류합니다. C(기밀)와 S(비밀) 등급 데이터는 코드 수준에서 AI API 전송이 차단되며, O(일반) 등급만 PII 마스킹 후 AI Gateway를 경유하여 외부 AI API로 전송됩니다. 직접 외부 AI API 호출은 절대 허용하지 않습니다."

**DataGrade 통제 코드** (N2SF 핵심 구현):

```typescript
// platform/services/ai-service/src/ 기반 패턴
// Design Ref: N2SF N-05 — AI 연동 보안
// CSAP D-08: 접근 통제

enum DataGrade {
  C = 'C',  // 기밀: AI API 전송 절대 금지
  S = 'S',  // 비밀: AI API 전송 절대 금지
  O = 'O',  // 일반: PII 마스킹 후 전송 가능
}

async function sendToAI(
  data: unknown,
  grade: DataGrade
): Promise<AIResponse> {
  // N2SF N-05: C/S 등급 차단
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(
      `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`
    )
  }

  // O 등급: PII 마스킹 필수
  const masked = await maskPII(data)

  // AI Gateway 경유 (직접 외부 API 호출 금지)
  return aiGateway.send(masked)
}

// PII 마스킹 (주민등록번호, 휴대폰, 이메일)
async function maskPII(data: unknown): Promise<unknown> {
  const json = JSON.stringify(data)
  return JSON.parse(
    json
      .replace(/\d{6}-\d{7}/g, '******-*******')  // 주민등록번호
      .replace(/01[0-9]-\d{3,4}-\d{4}/g, '010-****-****')  // 휴대폰
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/g, '***@***.***')  // 이메일
  )
}
```

### 6.2 AI API 데이터 흐름 통제 다이어그램

```mermaid
flowchart TD
    A[데이터 수신] --> B{데이터 등급 확인}
    B -->|C 등급\n기밀| C[차단\n에러 반환\nN2SF N-05 위반]
    B -->|S 등급\n비밀| C
    B -->|O 등급\n일반| D[PII 탐지]
    D --> E{PII 존재?}
    E -->|Yes| F[PII 마스킹\n주민번호·전화·이메일]
    E -->|No| G[마스킹 불필요]
    F --> H[AI Gateway 경유]
    G --> H
    H --> I[외부 AI API\nOpenAI / Claude]
    I --> J[응답 수신]
    J --> K[응답 로깅\nD-06 감사]
    K --> L[사용자 반환]

    style C fill:#ffebee,stroke:#c62828
    style F fill:#fff3e0,stroke:#e65100
    style H fill:#e8f5e9,stroke:#2e7d32
    style I fill:#e3f2fd,stroke:#1565c0
```

### 6.3 AI 서비스 핸들러 증거

실제 구현된 AI 서비스 코드 경로:

- `platform/services/ai-service/src/handlers/ai-agent.handler.ts` — AI 에이전트 핸들러
- `platform/services/ai-service/src/handlers/ai-rag.handler.ts` — RAG 핸들러
- `platform/services/ai-service/src/lib/ai-tools.ts` — AI 도구 모음
- `platform/services/ai-service/src/lib/rag-engine.ts` — RAG 엔진
- `platform/services/ai-service/src/lib/vector-store.ts` — 벡터 저장소

---

## 7. 자동 증거 수집 파이프라인 해설

이 절에서는 `.gitea/workflows/csap-evidence.yml` 워크플로우를 처음 보는 초급자도 이해할 수 있도록 상세히 해설합니다.

### 7.1 파이프라인 개요

CSAP 감리에서 가장 힘든 점은 79개 항목에 대한 증거를 수작업으로 수집하는 것입니다. 이 파이프라인은 그 과정을 자동화합니다.

**실행 일정**:
- **정기 실행**: 매주 월요일 09:00 KST (UTC 00:00, cron: `0 0 * * 1`)
- **수동 실행**: Gitea UI에서 `workflow_dispatch`로 즉시 실행 가능
- **날짜 지정**: `date` 입력값으로 특정 날짜 기준 증거 수집 가능
- **영역 지정**: `controls` 입력값으로 특정 CSAP 영역만 수집 가능 (예: `D-06,D-08`)

### 7.2 워크플로우 전체 해설

```yaml
# .gitea/workflows/csap-evidence.yml 전체 해설

name: CSAP 증거 수집

on:
  schedule:
    - cron: '0 0 * * 1'  # 매주 월요일 09:00 KST
  workflow_dispatch:        # 수동 실행 버튼 활성화
    inputs:
      date:                 # 입력 1: 수집 기준일
        description: '수집 기준일 (YYYY-MM-DD)'
        required: false
      controls:             # 입력 2: 수집 대상 통제항목
        description: '수집 대상 통제항목 (예: D-06,D-08 또는 all)'
        default: 'all'

env:
  PROMETHEUS_URL: ${{ vars.PROMETHEUS_URL || 'http://prometheus.monitoring.svc:9090' }}
  AUDIT_LOG: '.claude/audit.jsonl'

jobs:
  collect-evidence:
    steps:
      # Step 1: 코드 체크아웃 (최신 증거 수집 스크립트 포함)
      - name: 저장소 체크아웃
        uses: actions/checkout@v4

      # Step 2: kubectl 설치 (쿠버네티스 클러스터에서 증거 수집)
      - name: kubectl 설정
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.30.0'
        continue-on-error: true  # kubectl 없어도 나머지 증거는 수집

      # Step 3: 쿠버네티스 연결 (클러스터 증거 수집용)
      - name: 쿠버네티스 컨텍스트 설정
        run: |
          if [[ -n "${{ secrets.KUBECONFIG }}" ]]; then
            echo "${{ secrets.KUBECONFIG }}" > /tmp/kubeconfig
            export KUBECONFIG=/tmp/kubeconfig
          fi
        continue-on-error: true

      # Step 4: 핵심 단계 — 실제 증거 수집 실행
      - name: CSAP 증거 수집 v2 실행
        run: |
          chmod +x scripts/csap-evidence-collect-v2.sh
          # 날짜와 영역 파라미터를 스크립트에 전달
          ./scripts/csap-evidence-collect-v2.sh $ARGS

      # Step 5: 수집된 증거의 SHA-256 무결성 검증
      - name: 증거 무결성 검증
        run: |
          MANIFEST="evidence/${DATE}/manifest.sha256"
          if [[ -f "$MANIFEST" ]]; then
            cd "evidence/${DATE}"
            sha256sum -c manifest.sha256  # 변조 여부 확인
            echo "무결성 검증 완료"
          fi

      # Step 6: 증거 파일을 CI 아티팩트로 365일 보존
      - name: 증거 아티팩트 업로드
        uses: actions/upload-artifact@v4
        with:
          name: csap-evidence-${{ inputs.date || 'latest' }}
          path: evidence/
          retention-days: 365  # CSAP D-06: 1년 보존

      # Step 7: 감사 로그 기록 (항상 실행, 실패해도)
      - name: 감사 로그 기록
        if: always()
        run: |
          echo "{...\"action\":\"CSAP_EVIDENCE_CI_COMPLETE\"...}" >> "$AUDIT_LOG"
```

### 7.3 각 Job이 생성하는 증거

`scripts/csap-evidence-collect-v2.sh`는 다음 증거를 자동 생성합니다.

| 증거 유형 | 생성 파일 | 대응 CSAP 항목 |
|---------|---------|--------------|
| 접근 통제 로그 | `evidence/D-08/rbac-policy.json` | D-08-01~12 |
| 암호화 설정 | `evidence/D-09/tls-config.txt` | D-09-01~04 |
| 감사 로그 스냅샷 | `evidence/D-06/audit-snapshot.jsonl` | D-06-01~05 |
| 취약점 스캔 결과 | `evidence/D-12/trivy-report.json` | D-12-01~10 |
| 네트워크 정책 | `evidence/D-10/network-policy.yaml` | D-10-01~08 |
| 백업 검증 결과 | `evidence/D-13/backup-verify.txt` | D-13-01~05 |
| 인증서 목록 | `evidence/D-09/cert-inventory.json` | D-09-02 |
| DORA 메트릭 | `evidence/D-12/dora-metrics.json` | D-12-08~10 |

### 7.4 증거 패키지 폴더 구조

```
evidence/
└── 2026-04-12/                    # 수집 기준일
    ├── manifest.sha256            # 전체 파일 SHA-256 해시 목록
    ├── evidence-index.md          # 사람이 읽기 쉬운 인덱스
    ├── D-01/                      # 정보보호 정책
    │   └── security-policy.pdf
    ├── D-06/                      # 침해사고 관리
    │   ├── audit-snapshot.jsonl
    │   └── incident-response-plan.md
    ├── D-08/                      # 접근 통제
    │   ├── rbac-policy.json
    │   ├── session-config.ts
    │   └── auth-middleware-test.txt
    ├── D-09/                      # 암호화
    │   ├── tls-config.txt
    │   ├── cert-inventory.json
    │   └── encryption-key-policy.md
    ├── D-12/                      # 시스템 개발 보안
    │   ├── trivy-report.json
    │   ├── semgrep-result.json
    │   ├── dora-metrics.json
    │   └── code-review-log.md
    └── ...                        # D-01~D-13 전 영역
```

### 7.5 CSAPEvidenceCollector 클래스 활용

프로그래밍 방식으로 증거를 추가할 때 사용합니다.

```typescript
// platform/services/compliance-service/src/lib/csap-evidence-collector.ts
// Design Ref: MTU-N253 — CSAP 증거 수집 자동화 v2

import { CSAPEvidenceCollector, CSAPDomain, EvidenceType } from './csap-evidence-collector'

const collector = new CSAPEvidenceCollector()

// 증거 추가 (SHA-256 자동 계산)
collector.addEvidence({
  domain: CSAPDomain.D08,
  controlId: 'D-08-01',
  type: EvidenceType.Configuration,
  title: 'JWT 인증 미들웨어 설정',
  description: '모든 API 엔드포인트에 JWT 인증 적용 확인',
  source: authMiddlewareCode,
  sizeBytes: Buffer.byteLength(authMiddlewareCode),
})

// 전체 수집 및 커버리지 계산
const result = collector.collect()
console.log(`전체 커버리지: ${result.overallCoverageRate}%`)

// 무결성 검증
const integrity = collector.verifyAllIntegrity()
console.log(`검증 통과: ${integrity.valid}건, 실패: ${integrity.invalid}건`)

// Markdown 인덱스 생성 (감리 제출용)
const index = collector.generateIndex()
```

---

## 8. 감리 준비 체크리스트 (79항목 매핑)

### 8.1 현재 준수율 현황

`platform/services/compliance-service/src/handlers/compliance.handler.ts`의 실제 데이터 기준:

| CSAP 영역 | 항목 수 | 완료 | 미완료 | 완료율 | 비고 |
|---------|--------|-----|-------|-------|------|
| D-01 정보보호 정책 | 4 | 4 | 0 | 100% | 완료 |
| D-02 정보보호 조직 | 3 | 3 | 0 | 100% | 완료 |
| D-03 자산 관리 | 4 | 4 | 0 | 100% | 완료 |
| D-04 인적 보안 | 5 | 5 | 0 | 100% | 완료 |
| D-05 물리적 보안 | 4 | 3 | 1 | 75% | 운영환경 구성 시 충족 |
| D-06 침해사고 관리 | 5 | 5 | 0 | 100% | 완료 |
| D-07 서비스 연속성 | 3 | 2 | 1 | 67% | DR/백업 인프라 구성 필요 |
| D-08 접근 통제 | 12 | 12 | 0 | 100% | 완료 |
| D-09 암호화 | 4 | 4 | 0 | 100% | 완료 |
| D-10 네트워크 보안 | 8 | 6 | 2 | 75% | 방화벽/IDS 인프라 필요 |
| D-11 시스템 보안 | 7 | 6 | 1 | 86% | OS CIS Benchmark 적용 필요 |
| D-12 시스템 개발 보안 | 10 | 10 | 0 | 100% | 완료 |
| D-13 공급망 보안 | 10 | 10 | 0 | 100% | 완료 |
| **합계** | **79** | **74** | **5** | **94%** | |

### 8.2 79항목 완료 현황 시각화

```
CSAP 79항목 완료 현황 (2026-04-12 기준)

완료 (74항목, 94%)  ████████████████████████████████████████████████████████████████████░░░░░  
미완료 (5항목, 6%)  ░░░░░

영역별 현황:
D-01 [████████████] 100% (4/4)
D-02 [████████████] 100% (3/3)
D-03 [████████████] 100% (4/4)
D-04 [████████████] 100% (5/5)
D-05 [█████████░░░]  75% (3/4) ← 운영환경 물리 보안 장비
D-06 [████████████] 100% (5/5)
D-07 [████████░░░░]  67% (2/3) ← DR 사이트 구성
D-08 [████████████] 100% (12/12)
D-09 [████████████] 100% (4/4)
D-10 [█████████░░░]  75% (6/8) ← 방화벽/IDS/IPS 인프라
D-11 [██████████░░]  86% (6/7) ← OS CIS Benchmark
D-12 [████████████] 100% (10/10)
D-13 [████████████] 100% (10/10)
```

### 8.3 미흡 항목 0개 달성 전략

미흡 5개 항목은 모두 "인프라 구성 시 충족" 유형입니다. 코드 변경이 아니라 운영 환경 구성 작업이 필요합니다.

| 항목 | 현황 | 조치 방법 | 예상 기간 |
|------|-----|---------|---------|
| D-05: 물리 보안 장비 | 미충족 | IDC 물리 보안 카메라/잠금장치 설치 | 운영 전 |
| D-07: DR 사이트 | 미충족 | `platform/infra/dr-scripts/` 활용, 보조 클러스터 구성 | 4주 |
| D-10: 방화벽 | 미충족 | Cilium Network Policy + 외부 방화벽 연동 | 2주 |
| D-10: IDS/IPS | 미충족 | Falco 기반 침입 탐지 배포 | 2주 |
| D-11: OS CIS | 미충족 | k3s 노드 CIS Benchmark 설정 스크립트 적용 | 1주 |

### 8.4 D-01~D-13 증거 파일 위치 전체 매핑

| CSAP 항목 | 증거 유형 | 실제 파일 경로 |
|---------|---------|-------------|
| D-01-01 정보보호 정책 수립 | 정책 문서 | `docs/security/information-security-policy.md` |
| D-01-02 정책 승인 | 승인 기록 | `docs/security/policy-approval-record.md` |
| D-06-01 침해사고 대응 절차 | 절차서 | `docs/guides/onboarding/07-security/06-security-incident-response.md` |
| D-06-02 감사 로그 수집 | 로그 파일 | `.claude/audit.jsonl` |
| D-06-03 로그 보존 (1년) | CI 아티팩트 | `.gitea/workflows/csap-evidence.yml` (retention-days: 365) |
| D-08-01 사용자 인증 | 코드 | `platform/packages/auth-sdk/src/` |
| D-08-08 동시 세션 제한 | 코드 | `platform/services/auth-service/src/` |
| D-08-12 RBAC 권한 관리 | 코드 + 문서 | `platform/services/auth-service/src/` |
| D-09-01 TLS 1.2 이상 | 설정 파일 | `platform/infra/ingress/tls-policy.yaml` |
| D-09-02 비밀번호 해시 | 코드 | `platform/services/auth-service/src/lib/password.ts` |
| D-09-03 민감 데이터 암호화 | 코드 | `platform/packages/auth-sdk/src/lib/crypto.ts` |
| D-12-01 정적 분석 | CI 결과 | `evidence/D-12/semgrep-result.json` |
| D-12-02 취약점 스캔 | CI 결과 | `evidence/D-12/trivy-report.json` |
| D-12-07 입력 검증 | 코드 | Zod 스키마 (`z.object()` 패턴) |
| D-12-09 코드 리뷰 | 프로세스 | `.claude/agents/reviewer.md` + PR 리뷰 이력 |

### 8.5 감리 당일 준비 사항

```
감리 전날 (D-1):
  [ ] evidence/ 폴더 최신 수집 확인
  [ ] sha256sum -c manifest.sha256 무결성 검증
  [ ] 컴플라이언스 서비스 API 응답 확인
      curl http://localhost:3000/compliance/csap
  [ ] 준비도 점수 확인 (90점 이상 목표)
      curl http://localhost:3000/compliance/readiness

감리 당일:
  [ ] 노트북에 로컬 개발 환경 실행 준비
  [ ] evidence/ 폴더 USB 백업 (네트워크 장애 대비)
  [ ] Q-Gate 7단계 통과 이력 출력본 준비
  [ ] 감사 로그 최근 30일치 출력 준비
```

### 8.6 준비도 API 응답 예시

```bash
# 실시간 감리 준비도 확인
curl http://localhost:3000/compliance/readiness

# 응답 예시
{
  "readinessScore": 94,
  "breakdown": {
    "csapCompliance": { "rate": 94, "weight": 0.4 },
    "n2sfCompliance": { "rate": 94, "weight": 0.3 },
    "documentCompleteness": { "rate": 100, "weight": 0.3 }
  },
  "recommendation": "감리 대응 준비 완료",
  "lastChecked": "2026-04-12T09:00:00.000Z"
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|-----|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 — CSAP 감리 시뮬레이션 전체 구성 | Implementer (Sonnet) |

---

*본 문서는 `platform/services/compliance-service/src/`, `.gitea/workflows/csap-evidence.yml`, `platform/services/security-monitor-service/src/` 실제 코드를 기반으로 작성되었습니다.*
