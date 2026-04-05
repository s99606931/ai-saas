# D08 접근 통제 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | CSAP-IMPL-D08 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| CSAP 분야 | D08 접근 통제 |
| 항목 수 | 12개 (CSAP-D08-01 ~ D08-12) |
| 통제 유형 | 기술적 통제 |
| 심사 방법 | 설정 확인 + 기술 검증 |
| 마스터 체크리스트 | [checklist-master.md#csap-d08-01](../checklist-master.md#csap-d08-01) |
| FR 매핑 | FR-2.3-D08 |

<!-- Design Ref: MTU-C3 Plan -- D08 접근 통제 -->
<!-- Plan SC: verifyToken + hasPermission 코드 예시 포함 -->

---

## 분야 개요

접근 통제는 CSAP 표준등급에서 **가장 많은 항목(12개)**을 가진 핵심 기술 통제 분야입니다. 인증(Authentication)과 인가(Authorization)를 통해 시스템 자원에 대한 접근을 통제하고, 모든 접근 이력을 기록합니다.

**핵심 키워드**: RBAC, JWT 세션 관리, MFA, 특권 계정, 접근 이력, API 통제

---

## CSAP-D08-01: 사용자 계정 관리 정책

> **중요도**: 상 | **구분**: 필수

### 구현 목표

계정 생성/변경/삭제 절차를 수립하고, 미사용 계정을 정기 정리한다.

### 구현 방법

**계정 수명 주기 관리**

```
계정 생성 → 권한 할당 → 활성 사용 → 권한 변경 → 비활성화 → 삭제
    │           │           │           │           │          │
    ▼           ▼           ▼           ▼           ▼          ▼
 승인 필수    최소 권한    이력 기록    승인 필수   90일 미사용  완전 삭제
 관리자 승인   RBAC 기반   audit.jsonl  관리자 승인  자동 비활성  데이터 보존
```

**미사용 계정 정리 정책**

| 항목 | 기준 |
|------|------|
| 비활성 경고 | 60일 미로그인 시 경고 메일 발송 |
| 자동 비활성화 | 90일 미로그인 시 계정 자동 잠금 |
| 삭제 검토 | 180일 미로그인 시 삭제 검토 대상 |
| 퇴직/이동 | 즉시 비활성화 + 30일 내 삭제 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 계정 관리 정책서 | PDF/문서 | 문서관리시스템 |
| 계정 목록 (최신) | 표 | 계정 관리 시스템 |
| 승인 이력 | 로그 | audit.jsonl |
| 미사용 계정 정리 기록 | 기록 | 계정 관리 시스템 |

---

## CSAP-D08-02: 비밀번호 정책

> **중요도**: 상 | **구분**: 필수

### 구현 목표

안전한 비밀번호 정책을 수립하고 기술적으로 강제한다.

### 구현 방법

**비밀번호 정책 기준**

| 항목 | 기준 |
|------|------|
| 최소 길이 | 8자 이상 (관리자 12자 이상) |
| 복잡도 | 영문 대/소문자 + 숫자 + 특수문자 조합 |
| 변경 주기 | 90일 (특권 계정 60일) |
| 이력 관리 | 최근 5개 비밀번호 재사용 금지 |
| 초기 비밀번호 | 최초 로그인 시 변경 강제 |
| 연속 실패 잠금 | 5회 연속 실패 시 30분 잠금 |

```typescript
// Zod 비밀번호 검증 스키마
import { z } from 'zod'

const passwordSchema = z.string()
  .min(8, '비밀번호는 8자 이상')
  .regex(/[A-Z]/, '대문자 1자 이상 포함')
  .regex(/[a-z]/, '소문자 1자 이상 포함')
  .regex(/[0-9]/, '숫자 1자 이상 포함')
  .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, '특수문자 1자 이상 포함')

// bcrypt 해시 저장 (CSAP-D09-04)
import bcrypt from 'bcrypt'
const COST_FACTOR = 12
const hashedPassword = await bcrypt.hash(password, COST_FACTOR)
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 비밀번호 정책서 | PDF/문서 | 문서관리시스템 |
| 시스템 비밀번호 설정 화면 | 스크린샷 | 문서관리시스템 |
| 비밀번호 검증 코드 | 소스코드 | Git 저장소 |

---

## CSAP-D08-03: 특권 계정 관리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

관리자/root 계정을 최소화하고 사용 이력을 전수 기록하며 정기 검토한다.

### 구현 방법

| 원칙 | 구현 |
|------|------|
| 특권 계정 최소화 | admin 역할 부여 인원 최소한(2~3명) |
| 공유 계정 금지 | 개인별 특권 계정 발급, 공용 root 사용 금지 |
| MFA 필수 | 특권 계정 로그인 시 OTP/FIDO2 필수 |
| 전수 감사 | 특권 계정 모든 작업 audit.jsonl 기록 |
| 정기 검토 | 분기 1회 특권 계정 목록 검토 및 불필요 권한 회수 |

```typescript
// 특권 계정 접근 감사 로그 (CSAP-D08-03)
async function adminAction(admin: User, action: string, target: string) {
  // 특권 계정 MFA 재확인 (세션 내 30분 초과 시)
  if (admin.role === 'admin' && !admin.mfaVerifiedRecently) {
    throw new Error('특권 작업: MFA 재인증 필요')
  }

  await auditLog({
    actor: admin.id,
    action: `ADMIN_${action}`,
    target,
    result: 'success',
    ip: getClientIP(),
    metadata: { role: 'admin', mfaVerified: true }
  })
}
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 특권 계정 목록 | 표 | 계정 관리 시스템 |
| 특권 계정 사용 이력 로그 | audit.jsonl | 로그 저장소 |
| 분기별 검토 기록 | 보고서 | 문서관리시스템 |

---

## CSAP-D08-04: 접근 권한 관리 (RBAC)

> **중요도**: 상 | **구분**: 필수

### 구현 목표

역할 기반 접근 통제(RBAC)를 적용하고 최소 권한 원칙을 준수한다.

### 구현 방법

**RBAC 역할-권한 매트릭스**

| 역할 | 사용자 관리 | 데이터 읽기 | 데이터 쓰기 | 데이터 삭제 | 시스템 설정 | 감사 로그 |
|------|-----------|-----------|-----------|-----------|-----------|---------|
| admin | O | O | O | O | O | O |
| manager | X | O | O | X | X | O |
| user | X | O | O (본인) | X | X | X |
| viewer | X | O | X | X | X | X |

```typescript
// RBAC 구현 패턴 (CSAP-D08-04)
type Role = 'admin' | 'manager' | 'user' | 'viewer'
type Permission = string  // 'resource:read' | 'resource:write' | ...

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin:   ['user:manage', 'resource:read', 'resource:write', 'resource:delete', 'system:config', 'audit:read'],
  manager: ['resource:read', 'resource:write', 'audit:read'],
  user:    ['resource:read', 'resource:write:own'],
  viewer:  ['resource:read'],
}

function hasPermission(user: { role: Role }, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
}

// API 엔드포인트 보호 미들웨어
function requirePermission(permission: Permission) {
  return async (req: Request) => {
    const user = await verifyToken(req.headers.get('authorization'))
    if (!hasPermission(user, permission)) {
      await auditLog({
        actor: user.id,
        action: 'ACCESS_DENIED',
        target: permission,
        result: 'failure',
        ip: getClientIP(req),
      })
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return null // 통과
  }
}

// 사용 예시
export async function DELETE(req: Request) {
  const denied = await requirePermission('resource:delete')(req)
  if (denied) return denied
  // 비즈니스 로직
}
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 권한 매트릭스 | 표 | 문서관리시스템 |
| RBAC 설정/코드 | 소스코드 | Git 저장소 |
| 권한 변경 승인 이력 | 로그 | audit.jsonl |

---

## CSAP-D08-05: 접근 이력 관리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

시스템 접근(로그인/로그아웃) 로그를 기록하고 비정상 접근을 탐지한다.

### 구현 방법

```typescript
// 로그인/로그아웃 이벤트 기록 (CSAP-D08-05)
async function handleLogin(email: string, password: string, ip: string) {
  const user = await findUserByEmail(email)

  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    await auditLog({
      actor: email,
      action: 'LOGIN_FAILED',
      target: 'auth',
      result: 'failure',
      ip,
      metadata: { reason: user ? 'wrong_password' : 'user_not_found' }
    })
    // 연속 실패 카운트 증가 (5회 시 잠금)
    await incrementFailedAttempts(email)
    return { error: 'Invalid credentials' }
  }

  await auditLog({
    actor: user.id,
    action: 'LOGIN_SUCCESS',
    target: 'auth',
    result: 'success',
    ip,
    metadata: { role: user.role }
  })

  await resetFailedAttempts(email)
  return { token: generateJWT(user) }
}
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 접근 로그 샘플 | audit.jsonl 발췌 | 로그 저장소 |
| 로그 보관 설정 (1년+) | 설정 문서 | 인프라 관리 |
| 비정상 접근 탐지 규칙 | 설정 | 모니터링 시스템 |

---

## CSAP-D08-06: 원격 접속 통제

> **중요도**: 상 | **구분**: 필수

### 구현 목표

VPN 또는 보안 채널을 통한 원격 접속만 허용하고 MFA를 적용한다.

### 구현 방법

| 원칙 | 구현 |
|------|------|
| VPN 필수 | 관리 영역 직접 SSH 접근 금지, VPN 경유 필수 |
| MFA 적용 | VPN 접속 시 OTP 인증 필수 |
| IP 제한 | VPN 대역 외 관리 포트 접근 차단 |
| 이력 기록 | VPN 접속 이력 전수 기록 (audit.jsonl) |
| 세션 관리 | VPN 세션 타임아웃 8시간, 유휴 30분 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| VPN 설정 | 설정 파일/스크린샷 | 인프라 관리 |
| 접근 제어 목록 (ACL) | 방화벽 규칙 | 네트워크 관리 |
| MFA 설정 화면 | 스크린샷 | 문서관리시스템 |

---

## CSAP-D08-07: 네트워크 접근 통제

> **중요도**: 상 | **구분**: 필수

### 구현 목표

네트워크 세그먼트별 접근 통제와 방화벽 규칙을 설정한다.

### 구현 방법

k3s 환경에서의 NetworkPolicy 기반 접근 통제:

```yaml
# k3s NetworkPolicy: 기본 차단 (deny-all) + 명시적 허용
# Design Ref: MTU-I1 container-security-baseline.md
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress

---
# 허용 규칙: 웹 -> API 서버만 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web-frontend
      ports:
        - port: 3000
          protocol: TCP
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 네트워크 구성도 | 다이어그램 | 문서관리시스템 |
| 방화벽/NetworkPolicy 규칙 | YAML/설정 | Git 저장소 |
| ACL 목록 | 표 | 네트워크 관리 |

---

## CSAP-D08-08: 서비스 이용자 인증

> **중요도**: 상 | **구분**: 필수

### 구현 목표

클라우드 서비스 이용자에 대한 안전한 인증 체계를 구현한다.

### 구현 방법

```typescript
// JWT 기반 인증 (CSAP-D08-08)
import jwt from 'jsonwebtoken'

const ACCESS_TOKEN_EXPIRY = '15m'   // 접근 토큰: 15분
const REFRESH_TOKEN_EXPIRY = '7d'   // 갱신 토큰: 7일

function generateTokens(user: User) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  )
  const refreshToken = jwt.sign(
    { sub: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  )
  return { accessToken, refreshToken }
}

async function verifyToken(authHeader: string | null): Promise<User> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('인증 토큰 누락', 401)
  }
  const token = authHeader.slice(7)
  const payload = jwt.verify(token, process.env.JWT_SECRET!)
  const user = await findUserById(payload.sub)
  if (!user) throw new AuthError('사용자 없음', 401)
  return user
}
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 인증 설정 화면 | 스크린샷 | 문서관리시스템 |
| 인증 방식 문서 | 기술 문서 | 문서관리시스템 |
| MFA 적용 현황 | 통계 | 계정 관리 시스템 |

---

## CSAP-D08-09: 세션 관리

> **중요도**: 중 | **구분**: 필수

### 구현 목표

세션 타임아웃, 동시 세션 제한, 로그아웃 시 세션 무효화를 구현한다.

### 구현 방법

| 항목 | 설정 |
|------|------|
| 접근 토큰 만료 | 15분 |
| 갱신 토큰 만료 | 7일 |
| 동시 세션 제한 | 최대 3개 |
| 유휴 타임아웃 | 30분 |
| 로그아웃 | 토큰 블랙리스트 즉시 등록 |

```typescript
// 토큰 블랙리스트 관리 (CSAP-D08-09, D08-12)
const TOKEN_BLACKLIST = new Set<string>()  // 운영: Redis 사용

async function logout(token: string, userId: string) {
  TOKEN_BLACKLIST.add(token)  // 블랙리스트 등록
  await auditLog({
    actor: userId,
    action: 'LOGOUT',
    target: 'session',
    result: 'success',
    ip: getClientIP(),
  })
}

// 동시 세션 제한 (최대 3개)
async function enforceSessionLimit(userId: string, newSessionId: string) {
  const sessions = await getActiveSessions(userId)
  if (sessions.length >= 3) {
    const oldest = sessions[0]
    await invalidateSession(oldest.id)
    await auditLog({
      actor: userId,
      action: 'SESSION_FORCED_LOGOUT',
      target: oldest.id,
      result: 'success',
      ip: getClientIP(),
      metadata: { reason: 'max_sessions_exceeded' }
    })
  }
}
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 세션 관리 설정 | 코드/설정 | Git 저장소 |
| 타임아웃 설정 증빙 | 스크린샷 | 문서관리시스템 |
| 동시 세션 제한 설정 | 코드/설정 | Git 저장소 |

---

## CSAP-D08-10: 관리 콘솔 접근 통제

> **중요도**: 상 | **구분**: 필수

### 구현 목표

관리 콘솔 접근을 IP로 제한하고 접근 이력을 전수 기록한다.

### 구현 방법

| 원칙 | 구현 |
|------|------|
| IP 화이트리스트 | 관리 콘솔은 VPN 대역에서만 접근 |
| 별도 인증 | 관리 콘솔 접근 시 추가 인증 (MFA) |
| 전수 기록 | 관리 콘솔 접근 및 작업 이력 audit.jsonl |
| 세션 관리 | 관리 콘솔 세션 타임아웃 15분 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 관리 콘솔 접근 설정 | 설정 파일 | 인프라 관리 |
| IP 제한 목록 | 방화벽 규칙 | 네트워크 관리 |
| 접근 이력 로그 | audit.jsonl | 로그 저장소 |

---

## CSAP-D08-11: API 접근 통제

> **중요도**: 상 | **구분**: 필수

### 구현 목표

API 키/토큰 기반 인증, Rate limiting, API 접근 이력을 기록한다.

### 구현 방법

```typescript
// Rate Limiting 미들웨어 (CSAP-D08-11)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function rateLimit(maxRequests: number, windowMs: number) {
  return async (req: Request): Promise<Response | null> => {
    const key = getClientIP(req)
    const now = Date.now()
    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
      return null
    }

    entry.count++
    if (entry.count > maxRequests) {
      await auditLog({
        actor: key,
        action: 'RATE_LIMIT_EXCEEDED',
        target: req.url,
        result: 'failure',
        ip: key,
      })
      return Response.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
      )
    }
    return null
  }
}

// 사용: 분당 100회 제한
const apiRateLimit = rateLimit(100, 60_000)
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| API 인증 설정 | 코드/설정 | Git 저장소 |
| Rate limit 설정 | 코드/설정 | Git 저장소 |
| API 접근 로그 | audit.jsonl | 로그 저장소 |

---

## CSAP-D08-12: 고객 데이터 접근 통제

> **중요도**: 상 | **구분**: 필수

### 구현 목표

고객 데이터 접근 시 별도 승인 절차를 적용하고 접근 이력을 전수 기록한다.

### 구현 방법

| 원칙 | 구현 |
|------|------|
| 별도 승인 | 고객 데이터 직접 조회 시 CISO 또는 데이터 책임자 사전 승인 |
| 접근 이력 | 고객 데이터 접근 전수 audit.jsonl 기록 |
| 반출 통제 | 데이터 내보내기(export) 시 별도 승인 + 사유 기록 |
| 마스킹 | 관리 화면에서 개인정보 기본 마스킹 표시 |
| 최소 노출 | 업무에 필요한 최소 필드만 조회 가능 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 데이터 접근 승인 절차서 | PDF/문서 | 문서관리시스템 |
| 접근 이력 로그 | audit.jsonl | 로그 저장소 |
| 반출 통제 설정 | 코드/설정 | Git 저장소 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- CSAP-D08 12항목 전수 구현 가이드. RBAC + JWT + MFA + Rate Limit 패턴 | Claude Code |
