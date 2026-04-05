# ISMS-P 보호 분야: P-01~P-14 접근 통제

> MTU-C6b | FR-2.4-P | 적용 기준일: 2026-04-05
> 참조: MTU-C6a (관리체계 16항목), CSAP D-08 (접근 통제 12항목)

---

## 개요

ISMS-P 보호대책 요구사항 중 접근 통제 분야 14개 항목의 구현 가이드입니다.
공공기관 SaaS 환경에서의 사용자 인증, 권한 관리, 특권 계정, 세션 관리 등을 다룹니다.

---

## 항목별 구현 가이드

### ISMS-P-P-01: 정책 수립 및 이행

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-01 |
| 요구사항 | 접근 통제 정책 수립 및 이행 |
| 핵심 요건 | 접근 권한 부여·변경·삭제 절차 문서화, 비인가 접근 차단 정책 |
| CSAP 중첩 | CSAP-D08-01 (사용자 계정 관리 정책) |
| 구현 패턴 | RBAC 정책 문서 + Kyverno 정책 자동 적용 |

**구현 예시**:
```typescript
// 접근 통제 정책 인터페이스
interface AccessControlPolicy {
  policyId: string
  version: string
  effectiveDate: string
  rules: AccessRule[]
}

interface AccessRule {
  resource: string
  roles: string[]
  actions: ('read' | 'write' | 'delete' | 'admin')[]
  conditions?: { timeWindow?: string; ipRange?: string }
}
```

**증적 자료**: 접근 통제 정책서 (연 1회 갱신), 정책 적용 결과 (audit.jsonl)

---

### ISMS-P-P-02: 사용자 계정 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-02 |
| 요구사항 | 사용자 계정 등록·변경·삭제 절차 수립 |
| 핵심 요건 | 인사 이동 시 계정 즉시 변경/삭제, 미사용 계정 90일 자동 비활성화 |
| CSAP 중첩 | CSAP-D08-02 (사용자 등록·삭제 절차) |
| 구현 패턴 | 계정 생명주기 관리 + 비활성 계정 자동 탐지 |

**구현 예시**:
```typescript
async function deactivateInactiveAccounts(): Promise<void> {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 90) // 90일 기준

  const inactiveUsers = await db.users.findMany({
    where: { lastLoginAt: { lt: threshold }, status: 'ACTIVE' }
  })

  for (const user of inactiveUsers) {
    await db.users.update({
      where: { id: user.id },
      data: { status: 'INACTIVE', deactivatedAt: new Date() }
    })
    await auditLog({
      actor: 'SYSTEM',
      action: 'ACCOUNT_DEACTIVATE',
      target: user.id,
      reason: 'ISMS-P-P-02: 90일 미사용 자동 비활성화',
      ismsPControls: ['ISMS-P-P-02'],
      csapControls: ['CSAP-D08-02']
    })
  }
}
```

**증적 자료**: 계정 관리 대장, 비활성 계정 처리 로그 (audit.jsonl)

---

### ISMS-P-P-03: 사용자 인증

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-03 |
| 요구사항 | 안전한 사용자 인증 수단 적용 |
| 핵심 요건 | 비밀번호 복잡성 (영문+숫자+특수 8자 이상), MFA 필수 (관리자), 로그인 실패 5회 잠금 |
| CSAP 중첩 | CSAP-D08-03 (인증 수단) |
| 구현 패턴 | bcrypt 해싱 + TOTP MFA + 계정 잠금 |

**구현 예시**:
```typescript
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  maxLoginAttempts: 5,
  lockoutDuration: 30 * 60 * 1000, // 30분
}

async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const user = await db.users.findUnique({ where: { email } })
  if (!user) return { success: false, reason: 'USER_NOT_FOUND' }

  if (user.loginAttempts >= PASSWORD_POLICY.maxLoginAttempts) {
    const lockoutEnd = new Date(user.lastFailedLogin.getTime() + PASSWORD_POLICY.lockoutDuration)
    if (new Date() < lockoutEnd) {
      await auditLog({ actor: email, action: 'LOGIN_BLOCKED', ismsPControls: ['ISMS-P-P-03'] })
      return { success: false, reason: 'ACCOUNT_LOCKED' }
    }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    await db.users.update({
      where: { id: user.id },
      data: { loginAttempts: { increment: 1 }, lastFailedLogin: new Date() }
    })
    return { success: false, reason: 'INVALID_PASSWORD' }
  }

  // MFA 검증 (관리자 필수)
  if (user.role === 'ADMIN' && !user.mfaEnabled) {
    return { success: false, reason: 'MFA_REQUIRED' }
  }

  await db.users.update({
    where: { id: user.id },
    data: { loginAttempts: 0, lastLoginAt: new Date() }
  })

  return { success: true, user }
}
```

**증적 자료**: 인증 정책 설정값, 로그인 시도 로그, MFA 적용 현황

---

### ISMS-P-P-04: 비밀번호 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-04 |
| 요구사항 | 안전한 비밀번호 관리 |
| 핵심 요건 | 90일 주기 변경, 이전 5개 비밀번호 재사용 금지, 초기 비밀번호 즉시 변경 |
| CSAP 중첩 | CSAP-D08-04 (비밀번호 관리) |

---

### ISMS-P-P-05: 특권 계정 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-05 |
| 요구사항 | 특권 계정 (admin, root) 별도 관리 |
| 핵심 요건 | 특권 계정 목록 관리, 사용 시 승인 절차, 작업 완료 후 즉시 로그오프, 공용 관리 계정 금지 |
| CSAP 중첩 | CSAP-D08-05 (특수 권한 관리) |

**구현 패턴**:
```typescript
// 특권 계정 작업 시 승인 + 감사 로그 필수
async function executePrivilegedAction(
  admin: User, action: string, target: string
): Promise<void> {
  // 1. 승인 확인
  const approval = await getApproval(admin.id, action, target)
  if (!approval) throw new Error('특권 작업 승인 필요 (ISMS-P-P-05)')

  // 2. 감사 로그 기록
  await auditLog({
    actor: admin.id,
    action: 'PRIVILEGED_ACTION',
    target,
    details: { actionType: action, approvalId: approval.id },
    ismsPControls: ['ISMS-P-P-05'],
    csapControls: ['CSAP-D08-05']
  })

  // 3. 작업 실행
  await performAction(action, target)
}
```

---

### ISMS-P-P-06: 접근 권한 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-06 |
| 요구사항 | 업무 역할 기반 최소 권한 부여 |
| 핵심 요건 | 역할 기반 접근 통제(RBAC), 직무 분리, 권한 부여 승인 절차 |
| CSAP 중첩 | CSAP-D08-06 (접근 권한 관리) |

---

### ISMS-P-P-07: 접근 권한 검토

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-07 |
| 요구사항 | 접근 권한 정기 검토 (분기 1회 이상) |
| 핵심 요건 | 분기별 권한 적정성 검토, 불필요 권한 즉시 회수, 검토 결과 기록 |
| CSAP 중첩 | CSAP-D08-07 (접근 권한 검토) |

---

### ISMS-P-P-08: 외부자 접근 통제

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-08 |
| 요구사항 | 외부 인력 접근 통제 |
| 핵심 요건 | 외부 인력 접근 신청·승인·해제 절차, 접근 기간 제한, 작업 완료 후 즉시 해지 |
| CSAP 중첩 | CSAP-D08-08 (외부자 접근 관리) |

---

### ISMS-P-P-09: 정보시스템 접근 통제

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-09 |
| 요구사항 | 서버·DB·네트워크 장비 접근 통제 |
| 핵심 요건 | IP 기반 접근 제한, 접근 승인 이력, 접근 로그 6개월 보관 |
| CSAP 중첩 | CSAP-D08-09 (서버 접근 통제) |

---

### ISMS-P-P-10: 응용 프로그램 접근 통제

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-10 |
| 요구사항 | 웹 애플리케이션 접근 권한 관리 |
| 핵심 요건 | API 엔드포인트별 권한 검사, 세션 관리, CSRF/XSS 방지 |
| CSAP 중첩 | CSAP-D08-10 (애플리케이션 접근 통제) |

---

### ISMS-P-P-11: 세션 관리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-11 |
| 요구사항 | 세션 타임아웃 및 동시 접속 제한 |
| 핵심 요건 | 비활동 15분 세션 만료, 동시 세션 최대 3개, 세션 하이재킹 방지 |
| CSAP 중첩 | CSAP-D08-11 (세션 관리) |

**구현 예시**:
```typescript
const SESSION_CONFIG = {
  accessTokenExpiry: 15 * 60,        // 15분 (초)
  refreshTokenExpiry: 7 * 24 * 3600, // 7일
  maxConcurrentSessions: 3,
  sessionIdRotation: true,
}

async function validateSession(token: string): Promise<Session | null> {
  const session = await sessionStore.get(token)
  if (!session) return null

  // 비활동 타임아웃 확인
  const inactiveMs = Date.now() - session.lastActivity
  if (inactiveMs > SESSION_CONFIG.accessTokenExpiry * 1000) {
    await sessionStore.delete(token)
    await auditLog({
      actor: session.userId,
      action: 'SESSION_EXPIRED',
      ismsPControls: ['ISMS-P-P-11'],
      csapControls: ['CSAP-D08-11']
    })
    return null
  }

  // 동시 세션 확인
  const activeSessions = await sessionStore.countByUser(session.userId)
  if (activeSessions > SESSION_CONFIG.maxConcurrentSessions) {
    // 가장 오래된 세션 종료
    await sessionStore.deleteOldest(session.userId)
  }

  session.lastActivity = Date.now()
  await sessionStore.update(token, session)
  return session
}
```

---

### ISMS-P-P-12: 물리적 접근 통제

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-12 |
| 요구사항 | 전산실·서버룸 물리적 접근 통제 |
| 핵심 요건 | 출입 통제 시스템, 방문자 기록, CCTV 녹화 보관 (90일 이상) |
| CSAP 중첩 | CSAP-D08-12 (물리적 접근 통제) |
| 공공 SaaS 적용 | k3s WSL2 환경에서는 호스트 머신 물리 보안으로 대체, CSP 위탁 시 CSP 물리보안 증적 확보 |

---

### ISMS-P-P-13: 모바일 기기 접근 통제

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-13 |
| 요구사항 | 모바일 기기를 통한 정보시스템 접근 관리 |
| 핵심 요건 | MDM(Mobile Device Management) 적용, 원격 삭제 기능, VPN 접속 필수 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유 항목) |

---

### ISMS-P-P-14: 원격 접근 통제

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-14 |
| 요구사항 | 원격 접근(재택근무, VPN) 보안 관리 |
| 핵심 요건 | VPN 필수, MFA 적용, 원격 접근 로그 기록, 업무 시간 외 접근 제한 |
| CSAP 중첩 | 해당 없음 (ISMS-P 고유 항목) |

---

## CSAP 교차 참조 요약

| ISMS-P 항목 | CSAP 매핑 | 비고 |
|-------------|----------|------|
| ISMS-P-P-01 | CSAP-D08-01 | 완전 중복 |
| ISMS-P-P-02 | CSAP-D08-02 | 완전 중복 |
| ISMS-P-P-03 | CSAP-D08-03 | 완전 중복 |
| ISMS-P-P-04 | CSAP-D08-04 | 완전 중복 |
| ISMS-P-P-05 | CSAP-D08-05 | 완전 중복 |
| ISMS-P-P-06 | CSAP-D08-06 | 완전 중복 |
| ISMS-P-P-07 | CSAP-D08-07 | 완전 중복 |
| ISMS-P-P-08 | CSAP-D08-08 | 완전 중복 |
| ISMS-P-P-09 | CSAP-D08-09 | 완전 중복 |
| ISMS-P-P-10 | CSAP-D08-10 | 완전 중복 |
| ISMS-P-P-11 | CSAP-D08-11 | 완전 중복 |
| ISMS-P-P-12 | CSAP-D08-12 | 완전 중복 |
| ISMS-P-P-13 | — | ISMS-P 고유 |
| ISMS-P-P-14 | — | ISMS-P 고유 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-C6b Do — 접근 통제 14항목 전수 작성 | Implementer Agent |
