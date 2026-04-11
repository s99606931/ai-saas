# 감사 로그 작성법 — CSAP D-06 준수

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: 민감 작업 기능을 개발하는 모든 개발자
> **소요 시간**: 약 45분
> **Plan SC**: FR-DORA.5 (감사 로그 연동)
> **CSAP**: D-06 (침해사고 관리 — 감사 로그 전수 기록)

---

## 목차

1. [어떤 작업을 로깅해야 하는가?](#1-어떤-작업을-로깅해야-하는가)
2. [auditLog() 함수 사용법](#2-auditlog-함수-사용법)
3. [audit.jsonl 파일 구조](#3-auditjsonl-파일-구조)
4. [로그 조회 방법](#4-로그-조회-방법)
5. [실습: 새 기능에 감사 로그 추가하기](#5-실습-새-기능에-감사-로그-추가하기)
6. [감사 로그 모범 사례](#6-감사-로그-모범-사례)

---

## 1. 어떤 작업을 로깅해야 하는가?

### 1.1 CSAP D-06이 요구하는 로그 대상

CSAP D-06(침해사고 관리)은 다음 작업에 대해 전수 기록을 요구합니다.

```
필수 로깅 대상:
  인증 관련
  ├── 로그인 성공 / 실패
  ├── 로그아웃
  ├── 비밀번호 변경
  ├── 2FA 활성화 / 비활성화
  └── 토큰 갱신

  접근 제어 관련
  ├── 역할 부여 / 취소
  ├── 권한 변경
  └── 관리자 권한 사용

  데이터 변경 관련
  ├── 사용자 생성 / 수정 / 삭제
  ├── 민감 데이터 조회 (PII, 금융 정보 등)
  ├── 대량 데이터 내보내기
  └── 데이터 일괄 수정 / 삭제

  시스템 관련
  ├── 설정 변경
  ├── 서비스 시작 / 중지
  └── 보안 정책 변경
```

### 1.2 로깅이 필요 없는 경우

```
일반 데이터 조회 (비민감):
  ├── 공개 게시판 읽기
  ├── 서비스 목록 조회
  └── 내 프로필 조회 (자신의 데이터)

시스템 내부 작업:
  ├── 헬스체크 (/health, /readiness)
  ├── 메트릭 수집 (/metrics)
  └── 정기 배치 작업 (개별 기록은 제외, 시작/완료만 기록)
```

### 1.3 판단 기준표

| 작업 | 로그 필요 여부 | 이유 |
|------|------------|------|
| 로그인 | ✅ 필수 | 접근 이력 추적 |
| 로그인 실패 | ✅ 필수 | 브루트포스 탐지 |
| 사용자 삭제 | ✅ 필수 | 데이터 변경 |
| 역할 변경 | ✅ 필수 | 권한 변경 |
| 개인정보 조회 | ✅ 필수 | 민감 데이터 접근 |
| 게시글 읽기 | ❌ 불필요 | 비민감 |
| 헬스체크 | ❌ 불필요 | 시스템 내부 |
| 자신의 프로필 조회 | ❌ 불필요 | 자기 데이터 |

---

## 2. auditLog() 함수 사용법

### 2.1 기본 사용법

```typescript
// 사용 예시
import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

// 서비스별 감사 로거 생성 (파일: src/lib/audit.ts)
const auditLogger = createAuditLogger({
  serviceName: 'auth-service',
  transport: createStandardTransport('auth-service'),
});

export async function logAuditEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: metadata?.userId as string ?? 'system',
    action,
    target: metadata?.target as string ?? 'system',
    targetType: metadata?.targetType as string ?? 'system',
    tenantId: metadata?.tenantId as string ?? 'system',
    ip: metadata?.ip as string ?? '0.0.0.0',
    userAgent: metadata?.userAgent as string ?? 'unknown',
    metadata,
  });
}
```

### 2.2 로그인 이벤트 예시

```typescript
// src/services/auth.service.ts
import { auditLogger } from '../lib/audit';

export async function login(
  email: string,
  password: string,
  req: Request
): Promise<AuthResult> {
  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  // 사용자 조회
  const user = await db.users.findFirst({ where: { email } });

  if (!user) {
    // ✅ 로그인 실패 (사용자 없음) — 반드시 기록
    await auditLogger.log({
      actor: email,           // 이메일 주소를 행위자로
      action: 'LOGIN_FAILED',
      target: 'auth',
      targetType: 'authentication',
      tenantId: 'unknown',
      ip,
      userAgent,
      metadata: {
        reason: 'user_not_found',
        email,  // 어떤 계정 시도인지
      },
    });
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    // ✅ 로그인 실패 (비밀번호 오류) — 반드시 기록
    await auditLogger.log({
      actor: user.id,
      action: 'LOGIN_FAILED',
      target: user.id,
      targetType: 'user',
      tenantId: user.tenantId,
      ip,
      userAgent,
      metadata: {
        reason: 'invalid_password',
        attemptCount: await getFailedAttemptCount(user.id),
      },
    });
    throw new Error('Invalid credentials');
  }

  // ✅ 로그인 성공 — 반드시 기록
  await auditLogger.log({
    actor: user.id,
    action: 'LOGIN_SUCCESS',
    target: user.id,
    targetType: 'user',
    tenantId: user.tenantId,
    ip,
    userAgent,
    metadata: {
      sessionId: generateSessionId(),
    },
  });

  return generateTokens(user);
}
```

### 2.3 사용자 삭제 예시

```typescript
// src/services/user.service.ts
import { auditLogger } from '../lib/audit';

export async function deleteUser(
  adminUser: AuthenticatedUser,
  targetUserId: string,
  req: Request
): Promise<void> {
  const targetUser = await db.users.findFirst({
    where: { id: targetUserId, tenantId: adminUser.tenantId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!targetUser) {
    throw new Error('User not found');
  }

  // ✅ 삭제 전에 감사 로그 기록 (삭제 실패해도 시도가 기록됨)
  await auditLogger.log({
    actor: adminUser.id,
    action: 'USER_DELETE',
    target: targetUserId,
    targetType: 'user',
    tenantId: adminUser.tenantId,
    ip: getClientIP(req),
    userAgent: req.headers.get('user-agent') ?? 'unknown',
    metadata: {
      deletedUser: {
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
      },
      reason: req.headers.get('x-deletion-reason') ?? 'admin request',
      adminRole: adminUser.role,
    },
  });

  // 실제 삭제 실행
  await db.users.delete({ where: { id: targetUserId } });
}
```

### 2.4 역할 변경 예시

```typescript
// src/services/role.service.ts
export async function changeUserRole(
  adminUser: AuthenticatedUser,
  targetUserId: string,
  newRole: string,
  req: Request
): Promise<void> {
  const targetUser = await db.users.findFirst({
    where: { id: targetUserId, tenantId: adminUser.tenantId },
  });

  const previousRole = targetUser?.role ?? 'unknown';

  // ✅ 역할 변경 감사 로그
  await auditLogger.log({
    actor: adminUser.id,
    action: 'ROLE_CHANGE',
    target: targetUserId,
    targetType: 'user',
    tenantId: adminUser.tenantId,
    ip: getClientIP(req),
    userAgent: req.headers.get('user-agent') ?? 'unknown',
    metadata: {
      previousRole,
      newRole,
      targetUserEmail: targetUser?.email,
    },
  });

  await db.users.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });
}
```

### 2.5 대량 내보내기 예시

```typescript
// src/services/export.service.ts
export async function exportUserData(
  requestingUser: AuthenticatedUser,
  filter: ExportFilter,
  req: Request
): Promise<Buffer> {
  // ✅ 대량 데이터 내보내기 — 반드시 기록 (PII 유출 경로)
  await auditLogger.log({
    actor: requestingUser.id,
    action: 'DATA_EXPORT',
    target: 'users',
    targetType: 'bulk_operation',
    tenantId: requestingUser.tenantId,
    ip: getClientIP(req),
    userAgent: req.headers.get('user-agent') ?? 'unknown',
    metadata: {
      exportFormat: filter.format,
      estimatedRecords: await db.users.count({
        where: { tenantId: requestingUser.tenantId }
      }),
      filterCriteria: filter,
      purpose: req.headers.get('x-export-purpose') ?? 'unspecified',
    },
  });

  return await generateExportFile(filter);
}
```

---

## 3. audit.jsonl 파일 구조

### 3.1 JSONL 형식 설명

`.claude/audit.jsonl`은 JSON Lines 형식입니다. 각 줄이 독립된 JSON 객체입니다.

```jsonl
{"timestamp":"2026-04-11T09:15:32.451Z","actor":"admin-001","action":"LOGIN_SUCCESS","target":"admin-001","targetType":"user","tenantId":"tenant-01","ip":"192.168.1.100","userAgent":"Mozilla/5.0...","metadata":{"sessionId":"sess-abc123"},"service":"auth-service","version":"1.2.3"}
{"timestamp":"2026-04-11T09:16:01.234Z","actor":"admin-001","action":"USER_DELETE","target":"user-456","targetType":"user","tenantId":"tenant-01","ip":"192.168.1.100","userAgent":"Mozilla/5.0...","metadata":{"deletedUser":{"email":"test@example.com","role":"editor"}},"service":"user-service","version":"1.2.3"}
{"timestamp":"2026-04-11T09:18:45.789Z","actor":"user-789","action":"LOGIN_FAILED","target":"user-789","targetType":"authentication","tenantId":"tenant-02","ip":"10.0.0.55","userAgent":"curl/7.88","metadata":{"reason":"invalid_password","attemptCount":3},"service":"auth-service","version":"1.2.3"}
```

### 3.2 필수 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `timestamp` | string | ISO 8601 UTC | `2026-04-11T09:15:32.451Z` |
| `actor` | string | 작업 수행자 ID | `admin-001` |
| `action` | string | 수행한 작업 (대문자) | `USER_DELETE` |
| `target` | string | 대상 리소스 ID | `user-456` |
| `targetType` | string | 대상 리소스 유형 | `user` |
| `tenantId` | string | 테넌트 ID | `tenant-01` |
| `ip` | string | 클라이언트 IP | `192.168.1.100` |
| `userAgent` | string | 클라이언트 정보 | `Mozilla/5.0...` |
| `service` | string | 서비스 이름 | `auth-service` |
| `metadata` | object | 추가 컨텍스트 | `{reason: "..."}` |

### 3.3 표준 action 명칭

일관성을 위해 다음 명칭을 사용합니다.

```
인증 관련:
  LOGIN_SUCCESS      — 로그인 성공
  LOGIN_FAILED       — 로그인 실패
  LOGOUT             — 로그아웃
  PASSWORD_CHANGE    — 비밀번호 변경
  TOKEN_REFRESH      — 토큰 갱신
  ACCOUNT_LOCKED     — 계정 잠금

사용자 관리:
  USER_CREATE        — 사용자 생성
  USER_UPDATE        — 사용자 정보 수정
  USER_DELETE        — 사용자 삭제
  USER_RESTORE       — 사용자 복원

권한 관리:
  ROLE_ASSIGN        — 역할 부여
  ROLE_REVOKE        — 역할 취소
  ROLE_CHANGE        — 역할 변경
  PERMISSION_GRANT   — 권한 부여
  PERMISSION_REVOKE  — 권한 취소

데이터 관련:
  DATA_EXPORT        — 데이터 내보내기
  DATA_IMPORT        — 데이터 가져오기
  DATA_BULK_DELETE   — 대량 삭제
  PII_ACCESS         — 개인정보 접근

시스템 관련:
  CONFIG_CHANGE      — 설정 변경
  SERVICE_START      — 서비스 시작
  SERVICE_STOP       — 서비스 중지
```

---

## 4. 로그 조회 방법

### 4.1 파일 직접 조회 (jq 사용)

```bash
# 전체 로그 보기 (보기 좋게 출력)
jq '.' .claude/audit.jsonl | head -50

# 특정 action 필터링
jq '. | select(.action == "USER_DELETE")' .claude/audit.jsonl

# 특정 사용자의 모든 작업
jq ". | select(.actor == \"admin-001\")" .claude/audit.jsonl

# 최근 1시간 로그
jq '. | select(.timestamp > "2026-04-11T08:00:00Z")' .claude/audit.jsonl

# 로그인 실패만 보기
jq '. | select(.action == "LOGIN_FAILED")' .claude/audit.jsonl

# IP별 로그인 실패 횟수 집계
jq '. | select(.action == "LOGIN_FAILED") | .ip' .claude/audit.jsonl | sort | uniq -c | sort -rn
```

### 4.2 Loki에서 감사 로그 조회

Grafana Explore에서 Loki 데이터소스 선택 후:

```logql
# 감사 로그 조회 (app 레이블로 필터)
{app="auth-service"} | json | action =~ "LOGIN_FAILED|USER_DELETE|ROLE_CHANGE"

# 특정 테넌트의 감사 로그
{namespace="saas-services"} | json | tenantId="tenant-01" | action != ""

# 의심스러운 IP의 활동
{namespace="saas-services"} | json | ip="10.0.0.55"

# 같은 IP에서 5분 내 10회 이상 로그인 실패
sum by (ip)(count_over_time(
  {app="auth-service"} | json | action="LOGIN_FAILED" [5m]
)) > 10
```

### 4.3 CSAP 감사를 위한 특정 기간 조회

```bash
# 특정 날짜 범위 조회 (감사 제출 시)
START="2026-04-01T00:00:00Z"
END="2026-04-11T23:59:59Z"

jq --arg start "$START" --arg end "$END" \
  '. | select(.timestamp >= $start and .timestamp <= $end)' \
  .claude/audit.jsonl > /tmp/audit-report-april.jsonl

# 조회된 건수 확인
wc -l /tmp/audit-report-april.jsonl
```

---

## 5. 실습: 새 기능에 감사 로그 추가하기

### 실습 목표

새로운 "테넌트 설정 변경" 기능을 만들면서 감사 로그를 올바르게 추가합니다.

### 5.1 실습 준비

```bash
# 실습용 브랜치 생성
git checkout -b feat/audit-practice
```

### 5.2 Step 1 — 기능 코드 작성

```typescript
// platform/services/tenant-service/src/services/tenant-config.service.ts
import { db } from '../lib/db';
import { auditLogger } from '../lib/audit';

interface TenantConfig {
  maxUsers: number;
  storageQuotaGB: number;
  features: string[];
}

// 감사 로그 없는 버전 (나쁜 예시 — 실습 시작점)
export async function updateTenantConfigBad(
  tenantId: string,
  config: Partial<TenantConfig>
): Promise<void> {
  await db.tenantConfigs.update({
    where: { tenantId },
    data: config,
  });
}
```

### 5.3 Step 2 — 감사 로그 추가

```typescript
// ✅ 감사 로그를 추가한 올바른 버전
export async function updateTenantConfig(
  adminUser: AuthenticatedUser,
  tenantId: string,
  config: Partial<TenantConfig>,
  req: Request
): Promise<void> {
  // 현재 설정값 조회 (변경 전후 비교를 위해)
  const currentConfig = await db.tenantConfigs.findFirst({
    where: { tenantId },
  });

  // ✅ 감사 로그 먼저 기록
  await auditLogger.log({
    actor: adminUser.id,
    action: 'CONFIG_CHANGE',
    target: tenantId,
    targetType: 'tenant_config',
    tenantId: adminUser.tenantId,  // 관리자의 테넌트
    ip: getClientIP(req),
    userAgent: req.headers.get('user-agent') ?? 'unknown',
    metadata: {
      changedTenantId: tenantId,  // 변경 대상 테넌트
      previousValues: currentConfig,
      newValues: config,
      changedFields: Object.keys(config),
    },
  });

  // 실제 설정 변경
  await db.tenantConfigs.update({
    where: { tenantId },
    data: config,
  });
}
```

### 5.4 Step 3 — 감사 로그 확인

```bash
# 코드 실행 후 감사 로그 확인
tail -5 .claude/audit.jsonl | jq .

# 예상 출력:
# {
#   "timestamp": "2026-04-11T10:30:00.000Z",
#   "actor": "admin-001",
#   "action": "CONFIG_CHANGE",
#   "target": "tenant-01",
#   "targetType": "tenant_config",
#   ...
# }
```

### 5.5 Step 4 — 테스트 작성

```typescript
// src/services/tenant-config.service.test.ts
import { updateTenantConfig } from './tenant-config.service';

describe('updateTenantConfig', () => {
  it('설정 변경 시 감사 로그가 기록된다', async () => {
    const mockAuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    // auditLogger를 모킹하여 호출 여부 확인
    vi.mocked(auditLogger).log = mockAuditLogger.log;

    await updateTenantConfig(
      mockAdminUser,
      'tenant-01',
      { maxUsers: 100 },
      mockRequest
    );

    expect(mockAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONFIG_CHANGE',
        target: 'tenant-01',
        metadata: expect.objectContaining({
          newValues: { maxUsers: 100 },
        }),
      })
    );
  });

  it('감사 로그 기록 실패 시에도 설정 변경은 진행된다', async () => {
    // 감사 로그 실패 시나리오
    vi.mocked(auditLogger).log = vi.fn().mockRejectedValue(new Error('Log write failed'));

    // 감사 로그 실패해도 설정 변경은 되어야 함
    // (단, 감사 로그 실패 자체는 별도 알림 필요)
    await expect(
      updateTenantConfig(mockAdminUser, 'tenant-01', { maxUsers: 100 }, mockRequest)
    ).resolves.not.toThrow();
  });
});
```

---

## 6. 감사 로그 모범 사례

### 6.1 감사 로그는 실패에 강해야 한다

```typescript
// ❌ NG: 감사 로그 실패 시 전체 작업이 중단됨
async function deleteUserBad(adminUser: User, userId: string) {
  await auditLogger.log({ action: 'USER_DELETE', target: userId /* ... */ });
  await db.users.delete({ where: { id: userId } });
  // 감사 로그 실패 시 삭제도 안 됨 (원자성 의존)
}

// ✅ OK: 감사 로그 실패를 별도로 처리
async function deleteUserGood(adminUser: User, userId: string, req: Request) {
  try {
    await auditLogger.log({
      actor: adminUser.id,
      action: 'USER_DELETE',
      target: userId,
      targetType: 'user',
      tenantId: adminUser.tenantId,
      ip: getClientIP(req),
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    });
  } catch (auditError) {
    // 감사 로그 실패는 별도 알림 (운영팀 즉시 조사 필요)
    logger.error({ auditError, userId }, '감사 로그 기록 실패 — 즉각 조사 필요');
    // CSAP 감사 로그 실패 자체가 D-06 위반이므로 알림 필수
    await sendAlertToSecurityTeam('AUDIT_LOG_FAILURE', { userId });
    // 작업 자체는 계속 진행 (비즈니스 연속성)
  }

  await db.users.delete({ where: { id: userId } });
}
```

### 6.2 PII는 감사 로그에도 마스킹

```typescript
// ❌ NG: 감사 로그에 평문 PII 포함
await auditLogger.log({
  action: 'USER_CREATE',
  metadata: {
    email: 'hong@example.com',
    ssn: '901231-1234567',        // 주민번호 노출!
    phoneNumber: '010-1234-5678', // 전화번호 노출!
  }
});

// ✅ OK: PII 마스킹 또는 해시
await auditLogger.log({
  action: 'USER_CREATE',
  metadata: {
    emailDomain: 'example.com',         // 도메인만 (개인 식별 불가)
    ssnMasked: '901231-*******',         // 마스킹
    phoneNumberMasked: '010-****-5678',  // 마스킹
    userIdHash: sha256(userId),          // 해시로 추적 가능하되 역추적 어려움
  }
});
```

### 6.3 민감 정보 제외 목록

```typescript
// 감사 로그에 절대 포함하지 않는 필드
const FORBIDDEN_IN_AUDIT_LOG = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'apiKey',
  'secret',
  'creditCardNumber',
  'ssn',  // 마스킹 후에만 가능
];

function sanitizeForAuditLog(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  for (const field of FORBIDDEN_IN_AUDIT_LOG) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}
```

### 6.4 감사 로그 검색 최적화

감사 로그를 나중에 효율적으로 검색하려면 메타데이터를 잘 설계해야 합니다.

```typescript
// ✅ 검색하기 좋은 메타데이터 구조
await auditLogger.log({
  action: 'DATA_EXPORT',
  metadata: {
    // 자주 검색할 필드는 최상위 레벨에
    exportFormat: 'CSV',
    recordCount: 1500,
    tenantId: 'tenant-01',  // actor의 tenantId와 다를 수 있음

    // 검색 덜 필요한 세부 정보는 nested
    details: {
      filterCriteria: { role: 'editor', createdAfter: '2026-01-01' },
      columns: ['name', 'email', 'role', 'createdAt'],
    }
  }
});
```

---

## CSAP D-06 준수 요약

| 요건 | 구현 방법 | 위치 |
|------|---------|------|
| 민감 작업 전수 기록 | auditLog() 호출 | 각 서비스 코드 |
| 1년 이상 보존 | append-only 저장 | audit.jsonl, Loki |
| 로그 무결성 | 수정/삭제 불가 구조 | MinIO Object Lock |
| 행위자/대상/시각 기록 | actor, target, timestamp 필드 | auditLog() 스키마 |
| IP 주소 기록 | ip 필드 | auditLog() 스키마 |

---

## 다음 단계

보안 섹션을 모두 완료했습니다.

학습 완료 기준 확인:
```
[ ] 05-monitoring: Prometheus + Grafana + Loki + DORA 이해
[ ] 06-cicd: CI 파이프라인 + Q-Gate + GitOps + 핫픽스 이해
[ ] 07-security: CSAP + 보안 코딩 + 감사 로그 이해
```

모두 완료했다면 팀 리드에게 온보딩 완료를 알리십시오.

---

> **참조**: `platform/services/compliance-service/src/lib/audit.ts` — 감사 로거 구현체
> **참조**: `platform/services/security-service/src/lib/audit.ts` — 보안 서비스 감사 로그
> **Plan SC**: FR-DORA.5 — 감사 로그 연동
> **CSAP 연관**: D-06 (침해사고 관리 — 감사 로그 전수 기록, 1년 보존)
