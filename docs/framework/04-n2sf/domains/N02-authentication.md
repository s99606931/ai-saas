# N02 인증 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-N02-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| N2SF 영역 | N02 인증 |
| 대상 독자 | 개발자, 보안 담당자, 아키텍트 |
| FR 매핑 | FR-3.3, FR-3.4, FR-3.5 |
| MTU 매핑 | MTU-C5 |

<!-- Design Ref: MTU-C5 Plan -- N02 인증 -->
<!-- Plan SC: C/S/O 등급별 인증 요건 명시, CSAP D08 전수 역참조 -->

---

## 1. 영역 개요

N02 인증 영역은 사용자 식별, 인증, 접근 권한 관리를 다룹니다.
CSAP D08(접근 통제) 12개 항목 전수와 직접 대응되며, 등급별로 인증 강도와 세션 관리 정책이 차등 적용됩니다.

### 핵심 원칙

- **다중 인증(MFA)**: C/S 등급 필수, O 등급 권고
- **최소 권한**: 역할 기반 접근 통제(RBAC)로 필요 최소한 권한만 부여
- **세션 제한**: 등급별 세션 유효 시간 및 동시 접속 제한

---

## 2. C/S/O 등급별 통제 요건

| 통제 항목 | C 등급 (기밀) | S 등급 (민감) | O 등급 (공개) |
|---------|-------------|-------------|-------------|
| 인증 방식 | 다중 인증 필수 (OTP + 생체 또는 공인인증서) | 다중 인증 필수 (OTP) | 아이디/비밀번호 허용 |
| 비밀번호 정책 | 12자 이상, 대/소/숫자/특수 필수, 90일 변경 | 10자 이상, 3종 조합, 90일 변경 | 8자 이상, 2종 조합 |
| 세션 유효 시간 | 15분 | 30분 | 60분 |
| 동시 세션 제한 | 1개 (단일 세션 강제) | 2개 | 3개 |
| 로그인 실패 잠금 | 3회 실패 → 계정 잠금 (관리자 해제) | 5회 실패 → 30분 잠금 | 10회 실패 → 15분 잠금 |
| 특권 계정 관리 | 별도 계정 + 매 접근 승인 + 세션 녹화 | 별도 계정 필수 + 2인 승인 | 역할 분리 권고 |
| 접근 권한 검토 | 월 1회 검토 + 미사용 계정 즉시 비활성화 | 분기 1회 검토 | 반기 1회 검토 |
| 원격 접근 | VPN + MFA 필수, 접근 시간대 제한 | VPN + MFA 필수 | VPN 권고 |

---

## 3. CSAP D08 통제항목 역참조 (12항목 전수)

| CSAP ID | 항목명 | N02 구현 요건 | 구현 패턴 |
|---------|--------|------------|---------|
| [CSAP-D08-01](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-01) | 사용자 식별·인증 | 고유 ID + 인증 수단 조합 | JWT + RBAC |
| [CSAP-D08-02](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-02) | 접근 권한 최소화 | 역할별 최소 권한 부여 | ClusterRole (최소 권한) |
| [CSAP-D08-03](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-03) | 접근 권한 관리 | 권한 부여·변경·회수 프로세스 | RBAC 정책 파일 |
| [CSAP-D08-04](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-04) | 접근 권한 검토 | 정기 검토 + 미사용 계정 정리 | 자동화 스크립트 |
| [CSAP-D08-05](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-05) | 특권 계정 관리 | 별도 계정, 2인 승인, 세션 감사 | PAM 시스템 |
| [CSAP-D08-06](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-06) | 비밀번호 관리 | 등급별 복잡도, 변경 주기, 이력 관리 | bcrypt + 정책 엔진 |
| [CSAP-D08-07](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-07) | 사용자 인증 방식 | MFA 적용, 인증서 기반 인증 | OTP + FIDO2 |
| [CSAP-D08-08](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-08) | 네트워크 접근 통제 | IP 기반 접근 제한, VPN 강제 | NetworkPolicy + VPN |
| [CSAP-D08-09](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-09) | 세션 관리 | 타임아웃, 동시 접속 제한, 세션 무효화 | JWT 만료 + 블랙리스트 |
| [CSAP-D08-10](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-10) | 접근 로그 기록 | 모든 접근 시도 기록 (성공/실패) | audit.jsonl |
| [CSAP-D08-11](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-11) | 접근 권한 회수 | 퇴직·전보 시 즉시 회수 | 자동화 워크플로우 |
| [CSAP-D08-12](../../02-csap/standard-grade/implementation-guide/D08-access-control.md#csap-d08-12) | 원격 접근 통제 | VPN + MFA, 접근 시간대 제한 | WireGuard + OTP |

---

## 4. 구현 패턴

### 4.1 JWT + RBAC 인증 흐름

```typescript
// N02 + CSAP-D08 인증 패턴

// 1. 사용자 인증 (CSAP-D08-01)
interface AuthRequest {
  userId: string
  password: string
  otpCode?: string       // C/S 등급 필수
  biometric?: string     // C 등급 필수
}

// 2. JWT 토큰 발급 (CSAP-D08-09 세션 관리)
interface JWTPayload {
  sub: string            // 사용자 고유 ID
  role: UserRole         // RBAC 역할
  dataGrade: DataGrade   // 접근 허용 데이터 등급
  iat: number            // 발급 시간
  exp: number            // 만료 시간 (등급별 상이)
}

// 등급별 토큰 만료 시간
const SESSION_TIMEOUT: Record<DataGrade, number> = {
  C: 15 * 60,    // 15분 (기밀)
  S: 30 * 60,    // 30분 (민감)
  O: 60 * 60,    // 60분 (공개)
}

// 3. RBAC 권한 검사 (CSAP-D08-02, D08-03)
type Permission = 'read' | 'write' | 'delete' | 'admin'
type Resource = 'users' | 'documents' | 'audit-logs' | 'settings'

interface RBACPolicy {
  role: UserRole
  permissions: Map<Resource, Permission[]>
}

async function checkPermission(
  user: AuthenticatedUser,
  resource: Resource,
  action: Permission
): Promise<boolean> {
  const policy = await getRBACPolicy(user.role)
  const allowed = policy.permissions.get(resource)?.includes(action) ?? false

  // CSAP-D08-10: 접근 로그 기록
  await auditLog({
    actor: user.id,
    action: `ACCESS_${action.toUpperCase()}`,
    resource,
    result: allowed ? 'SUCCESS' : 'BLOCKED',
    dataGrade: user.dataGrade,
    n2sfDomain: 'N02',
    csapControl: 'D08-02',
  })

  return allowed
}
```

### 4.2 로그인 실패 잠금 (CSAP-D08-06)

```typescript
// 등급별 로그인 실패 잠금 정책
const LOGIN_LOCK_POLICY: Record<DataGrade, {
  maxAttempts: number
  lockDuration: number     // 초
  lockType: 'admin' | 'timed'
}> = {
  C: { maxAttempts: 3, lockDuration: Infinity, lockType: 'admin' },
  S: { maxAttempts: 5, lockDuration: 30 * 60, lockType: 'timed' },
  O: { maxAttempts: 10, lockDuration: 15 * 60, lockType: 'timed' },
}

async function handleLoginAttempt(
  userId: string,
  success: boolean,
  grade: DataGrade
): Promise<void> {
  if (success) {
    await resetFailedAttempts(userId)
    return
  }

  const attempts = await incrementFailedAttempts(userId)
  const policy = LOGIN_LOCK_POLICY[grade]

  if (attempts >= policy.maxAttempts) {
    await lockAccount(userId, policy.lockType, policy.lockDuration)
    await auditLog({
      actor: 'SYSTEM',
      action: 'ACCOUNT_LOCKED',
      target: userId,
      n2sfDomain: 'N02',
      csapControl: 'D08-06',
      result: 'BLOCKED',
    })
  }
}
```

### 4.3 k8s ServiceAccount RBAC (CSAP-D08-01, D08-02)

```yaml
# N2SF N02 기반 k8s RBAC 구현
# 등급별 ServiceAccount + Role 분리

# C 등급 Namespace 전용 ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: grade-c-app-sa
  namespace: grade-c
  labels:
    n2sf.area: "N02"
    data-grade: "C"
  annotations:
    csap.control: "D08-01, D08-02"
---
# C 등급: 최소 권한 Role (읽기 전용)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: grade-c-minimal-role
  namespace: grade-c
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get"]               # 최소 권한만 부여
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: []                    # Secret 접근 금지 (Sealed Secrets 사용)
---
# O 등급 Namespace: 상대적으로 완화된 권한
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: grade-o-app-role
  namespace: grade-o
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]               # O 등급은 Secret 읽기 허용
```

---

## 5. 접근 권한 검토 자동화

```bash
#!/bin/bash
# N02 접근 권한 정기 검토 스크립트
# CSAP-D08-04: 미사용 계정 탐지 + 비활성화

# 1. 30일 이상 미사용 ServiceAccount 탐지
echo "=== N02 접근 권한 검토 $(date +%Y-%m-%d) ==="

# k8s ServiceAccount 마지막 사용 일자 확인
kubectl get serviceaccounts --all-namespaces -o json | \
  jq -r '.items[] | select(.metadata.labels."n2sf.area" == "N02") |
  "\(.metadata.namespace)/\(.metadata.name)"'

# 2. 권한 과다 부여 탐지 (ClusterRoleBinding 중 cluster-admin)
echo "--- 과도한 권한 부여 탐지 ---"
kubectl get clusterrolebindings -o json | \
  jq -r '.items[] | select(.roleRef.name == "cluster-admin") |
  .subjects[]? | "\(.kind)/\(.name)"'

# 3. 검토 결과 감사 로그 기록
cat >> /shared/audit.jsonl << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "actor": "SYSTEM",
  "action": "ACCESS_REVIEW",
  "n2sfDomain": "N02",
  "csapControl": "D08-04",
  "result": "SUCCESS"
}
EOF
```

---

## 6. 증적 자료 체크리스트

| 번호 | 증적 자료 | 보관 주기 | 비고 |
|------|---------|---------|------|
| 1 | 사용자 계정 목록 + 역할 매핑 | 최신 유지 | RBAC 정책 파일 |
| 2 | 접근 로그 (audit.jsonl) | 1년 이상 | CSAP-D08-10 |
| 3 | 로그인 실패 잠금 기록 | 1년 | CSAP-D08-06 |
| 4 | 접근 권한 검토 보고서 | 3년 | 등급별 주기 상이 |
| 5 | MFA 적용 현황 | 최신 유지 | C/S 등급 필수 확인 |
| 6 | 특권 계정 사용 기록 | 1년 | 세션 녹화 포함 (C 등급) |
| 7 | VPN 접근 로그 | 1년 | 원격 접근 기록 |

---

## 7. 관련 문서

- [CSAP x N2SF 전수 매핑 테이블](../csap-n2sf-mapping.md) (MTU-C4)
- [데이터 등급 분류 체계](../data-grade-classification.md) (MTU-C4)
- [CSAP D08 접근 통제 구현 가이드](../../02-csap/standard-grade/implementation-guide/D08-access-control.md)
- [N03 격리 구현 가이드](./N03-isolation.md) (N02 인증과 N03 격리 연계)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — N02 인증 구현 가이드 (CSAP D08 12항목 전수 역참조) | Claude Code |
