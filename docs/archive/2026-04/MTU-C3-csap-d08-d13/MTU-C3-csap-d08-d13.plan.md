# MTU-C3: CSAP D08~D13 구현 가이드 (접근통제·암호화·네트워크보안·가상화보안·시스템개발보안·공공기관추가보호조치)

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C3 |
| Phase | Phase 2 Core Security |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-2.3c (D08~D13 분야) |
| 의존 MTU | MTU-C1, MTU-C2a, MTU-C2b |
| 예상 세션 | 2 세션 |

---

## 목적

CSAP 표준등급 D08~D13 분야 (접근통제·암호화·네트워크보안·가상화보안·시스템개발보안·공공기관추가보호조치) 구현 가이드를 제공합니다.
이 분야들은 기술적 통제 중심으로, 코드 예시와 설정 패턴이 핵심입니다.

**시장조사 연계**:
- D12 시스템개발보안: Policy as Code (MTU-C7) — Kyverno/OPA로 CSAP 통제 자동 적용
- D13 공공기관추가보호조치: Harbor + Sigstore (MTU-C8) — 이미지 서명·SBOM 검증으로 공급망 보안 강화

---

## 산출물 파일 (6개)

| 파일 | CSAP 분야 | 항목 수 | 핵심 내용 |
|------|---------|---------|---------|
| `02-csap/standard-grade/implementation-guide/D08-access-control.md` | 접근 통제 | 12 | RBAC 구현, JWT 세션 관리, 특권 계정 통제 |
| `02-csap/standard-grade/implementation-guide/D09-encryption.md` | 암호화 | 4 | AES-256 저장 암호화, TLS 1.3+ 전송, 키 관리 |
| `02-csap/standard-grade/implementation-guide/D10-network-security.md` | 네트워크 보안 | 8 | 방화벽 정책, 네트워크 분리, 침입 탐지, 트래픽 암호화 |
| `02-csap/standard-grade/implementation-guide/D11-virtualization-security.md` | 가상화 보안 | 7 | 컨테이너 격리, k3s 보안 설정, 이미지 무결성, 하이퍼바이저 보호 |
| `02-csap/standard-grade/implementation-guide/D12-system-dev-security.md` | 시스템 개발 보안 | 10 | SAST/DAST, Zod 입력 검증, MTU-C7 Policy as Code 연계 |
| `02-csap/standard-grade/implementation-guide/D13-public-agency-additional.md` | 공공기관 추가 보호조치 | 10 | 공공 SaaS 특수 요건, 행안부 고시 준수, MTU-C8 Harbor 연계 |

---

## CSAP 분야별 항목 구조

### D08 접근 통제 (12항목)

| CSAP ID | 항목명 | 구분 | 중요도 | 핵심 구현 |
|---------|--------|------|--------|---------|
| CSAP-D08-01 | 계정 권한 분리 | 필수 | 상 | RBAC 역할 정의 (admin/user/viewer) |
| CSAP-D08-02 | 최소 권한 원칙 | 필수 | 상 | API 엔드포인트별 `hasPermission()` 검사 |
| CSAP-D08-03 | 특권 계정 관리 | 필수 | 상 | 특권 계정 목록 + 접근 이력 감사 로그 |
| CSAP-D08-04 | 사용자 인증 | 필수 | 상 | JWT 토큰 (접근 15분, 갱신 7일) |
| CSAP-D08-05 | 다중 인증 | 필수 | 상 | OTP/FIDO2 (특권 계정 필수) |
| CSAP-D08-06 | 세션 관리 | 필수 | 상 | 동시 세션 제한 (최대 3개), 타임아웃 |
| CSAP-D08-07 | 접근 기록 | 필수 | 중 | audit.jsonl 모든 인증 이벤트 기록 |
| CSAP-D08-08 | 원격 접근 | 필수 | 상 | VPN + 다중 인증 필수, 직접 SSH 금지 |
| CSAP-D08-09 | 시스템 계정 | 필수 | 중 | 서비스 계정 최소 권한, 공유 계정 금지 |
| CSAP-D08-10 | 외부 접속 통제 | 필수 | 상 | IP 화이트리스트, 방화벽 정책 |
| CSAP-D08-11 | 접근 권한 검토 | 필수 | 중 | 분기별 권한 재검토 및 불필요 권한 회수 |
| CSAP-D08-12 | 로그아웃 처리 | 필수 | 중 | 토큰 블랙리스트 즉시 등록 |

### D09 암호화 (4항목)

| CSAP ID | 항목명 | 구분 | 중요도 | 핵심 구현 |
|---------|--------|------|--------|---------|
| CSAP-D09-01 | 저장 데이터 암호화 | 필수 | 상 | AES-256-GCM, 키는 환경 변수 관리 |
| CSAP-D09-02 | 전송 데이터 암호화 | 필수 | 상 | TLS 1.3 이상, HTTP 직접 통신 금지 |
| CSAP-D09-03 | 암호화 키 관리 | 필수 | 상 | 키 수명 주기 관리, 정기 교체 |
| CSAP-D09-04 | 비밀번호 암호화 | 필수 | 상 | bcrypt (cost factor 12 이상) |

### D10 네트워크 보안 (8항목)

| CSAP ID | 항목명 | 구분 | 중요도 | 핵심 구현 |
|---------|--------|------|--------|---------|
| CSAP-D10-01 | 네트워크 분리 | 필수 | 상 | 업무망·인터넷망·관리망 물리적/논리적 분리 |
| CSAP-D10-02 | 방화벽 정책 관리 | 필수 | 상 | 최소 허용 원칙, 정기 규칙 검토 |
| CSAP-D10-03 | 침입 탐지/차단 | 필수 | 상 | IDS/IPS 운영, 이상 트래픽 자동 차단 |
| CSAP-D10-04 | 네트워크 접근 통제 | 필수 | 상 | NAC 정책, 비인가 단말 접속 차단 |
| CSAP-D10-05 | 무선 네트워크 보안 | 필수 | 중 | WPA3 인증, 비인가 AP 탐지 |
| CSAP-D10-06 | 원격 접속 보안 | 필수 | 상 | VPN + 다중 인증, 접속 이력 기록 |
| CSAP-D10-07 | 네트워크 트래픽 암호화 | 필수 | 상 | TLS 1.3+, 내부 서비스 간 mTLS |
| CSAP-D10-08 | 네트워크 감사 로그 | 필수 | 중 | 네트워크 접속 이력 audit.jsonl 기록 |

### D11 가상화 보안 (7항목)

| CSAP ID | 항목명 | 구분 | 중요도 | 핵심 구현 |
|---------|--------|------|--------|---------|
| CSAP-D11-01 | 가상화 환경 격리 | 필수 | 상 | k3s 네임스페이스 격리, NetworkPolicy 적용 |
| CSAP-D11-02 | 하이퍼바이저 보안 | 필수 | 상 | WSL2 하이퍼바이저 보안 패치, 접근 제한 |
| CSAP-D11-03 | 컨테이너 이미지 보안 | 필수 | 상 | Trivy 스캔 통과 이미지만 배포 허용 |
| CSAP-D11-04 | 컨테이너 런타임 보안 | 필수 | 상 | 비특권 컨테이너, seccompProfile 적용 |
| CSAP-D11-05 | 가상머신 스냅샷 관리 | 필수 | 중 | 스냅샷 암호화, 접근 권한 최소화 |
| CSAP-D11-06 | 가상화 관리 콘솔 보안 | 필수 | 상 | 관리 콘솔 RBAC + 다중 인증 필수 |
| CSAP-D11-07 | 가상화 감사 로그 | 필수 | 중 | 가상 자원 생성·변경·삭제 audit.jsonl 기록 |

### D12 시스템 개발 보안 (10항목)

| CSAP ID | 항목명 | 구분 | 중요도 | 핵심 구현 |
|---------|--------|------|--------|---------|
| CSAP-D12-01 | 보안 요구사항 관리 | 필수 | 중 | FR 설계 단계 보안 요건 포함 의무화 |
| CSAP-D12-02 | 위협 모델링 | 필수 | 중 | STRIDE 모델, 주요 서비스 위협 분석 |
| CSAP-D12-03 | 입력 값 검증 | 필수 | 상 | Zod 스키마 검증, SQL 매개변수화 쿼리 |
| CSAP-D12-04 | 오류 처리 | 필수 | 중 | 내부 오류 외부 노출 금지, 에러 ID 반환 |
| CSAP-D12-05 | 암호화 알고리즘 | 필수 | 상 | 승인된 알고리즘 목록 사용 (KCMVP 기준) |
| CSAP-D12-06 | 정적 분석 | 필수 | 중 | SAST — CI/CD에 통합 (ESLint security) |
| CSAP-D12-07 | 동적 분석 | 권고 | 중 | DAST — OWASP ZAP 자동 스캔 |
| CSAP-D12-08 | 취약점 스캔 | 필수 | 상 | Trivy 이미지 스캔 (CI/CD 필수 통과) |
| CSAP-D12-09 | 소스코드 검토 | 필수 | 중 | 보안 코드 리뷰 체크리스트 (PR 필수) |
| CSAP-D12-10 | 인증 정보 보호 | 필수 | 상 | 하드코딩 시크릿 금지, git-secrets 훅 |

### D13 공공기관 추가 보호조치 (10항목)

| CSAP ID | 항목명 | 구분 | 중요도 | 핵심 구현 |
|---------|--------|------|--------|---------|
| CSAP-D13-01 | 공공 SaaS 보안 요건 | 필수 | 상 | 행안부 공공 SaaS 보안 가이드라인 준수 |
| CSAP-D13-02 | 행정 데이터 보호 | 필수 | 상 | 행정 정보 유형별 보호 등급 분류 및 통제 |
| CSAP-D13-03 | 개인정보 처리 방침 | 필수 | 상 | 공공기관 개인정보보호법 의무 준수 |
| CSAP-D13-04 | 공급망 보안 | 필수 | 상 | Harbor + Cosign + SBOM (MTU-C8) 이미지 서명 검증 |
| CSAP-D13-05 | CI/CD 파이프라인 보안 | 필수 | 상 | 파이프라인 격리, 시크릿 환경 변수 주입 |
| CSAP-D13-06 | 배포 환경 분리 | 필수 | 상 | dev/staging/prod 분리, 직접 prod 접근 금지 |
| CSAP-D13-07 | 클라우드 접근 통제 | 필수 | 상 | 공공 클라우드 전용 RBAC + IP 화이트리스트 |
| CSAP-D13-08 | 보안 패치 의무화 | 필수 | 상 | 행안부 고시 기반 패치 의무 기한 준수 |
| CSAP-D13-09 | 감사 추적 | 필수 | 상 | 배포 이력 audit.jsonl 자동 기록 |
| CSAP-D13-10 | 연간 보안 감사 | 필수 | 중 | 외부 보안 전문기관 연 1회 이상 감사 |

---

## 핵심 구현 패턴

### D08 RBAC 구현 패턴 (TypeScript)

```typescript
// ✅ 모든 API 엔드포인트에 RBAC 검사 필수 (CSAP-D08-02)
export async function GET(req: Request) {
  const user = await verifyToken(req.headers.get('authorization'))
  if (!hasPermission(user, 'resource:read')) {
    await auditLog({ actor: user.id, action: 'ACCESS_DENIED', resource: 'resource:read' })
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  // 비즈니스 로직
}

// 역할-권한 매핑 (CSAP-D08-01 계정 권한 분리)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin:  ['resource:read', 'resource:write', 'resource:delete', 'user:manage'],
  user:   ['resource:read', 'resource:write'],
  viewer: ['resource:read'],
}

function hasPermission(user: User, permission: string): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
}
```

### D09 암호화 패턴 (TypeScript)

```typescript
// ✅ AES-256-GCM 저장 암호화 (CSAP-D09-01)
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')  // 32바이트 필수

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

// ✅ bcrypt 비밀번호 해시 (CSAP-D09-04)
import bcrypt from 'bcrypt'
const hashedPassword = await bcrypt.hash(password, 12)  // cost factor 12 이상

// ❌ 하드코딩 금지 (CSAP-D11-10)
// const API_KEY = 'sk-1234567890'  // BLOCKED
const API_KEY = process.env.API_KEY
if (!API_KEY) throw new Error('API_KEY 환경 변수 누락')
```

### D12 → MTU-C7 Policy as Code 연계

D12 시스템개발보안의 자동화 통제는 MTU-C7 Policy as Code와 직접 연결됩니다:

```
D12 통제항목          → MTU-C7 자동 적용
─────────────────────────────────────────
CSAP-D12-03 (입력검증) → Kyverno: 허가된 이미지만 배포
CSAP-D12-08 (취약점)   → Kyverno: Trivy 통과 이미지만 허용
CSAP-D12-10 (시크릿)   → OPA: Secret 리소스 직접 마운트 금지
```

→ 상세 정책 구성: [`07-infra/policy-as-code/kyverno-policies.md`](../../07-infra/policy-as-code/kyverno-policies.md) (MTU-C7)

### D13 → MTU-C8 Harbor + Sigstore 연계

D13 공공기관추가보호조치의 공급망 보안은 MTU-C8 Supply Chain Security와 직접 연결됩니다:

```
D13 통제항목              → MTU-C8 자동 적용
──────────────────────────────────────────────
CSAP-D13-04 (공급망 보안)  → Cosign + Sigstore 이미지 서명
CSAP-D13-05 (CI/CD 보안)  → Harbor 이미지 스캔 정책 통과 필수
CSAP-D13-09 (감사 추적)   → audit.jsonl 자동 기록 (CI/CD 훅)
```

→ 상세 구성: [`07-infra/supply-chain/sigstore-signing.md`](../../07-infra/supply-chain/sigstore-signing.md) (MTU-C8)

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-2.3-D08 | D08 RBAC 구현 패턴 | `verifyToken` + `hasPermission` 코드 예시 포함 |
| FR-2.3-D09 | AES-256 + TLS 1.3 명시 | 알고리즘 코드 예시 + 설정 방법 완비 |
| FR-2.3-D10 | 네트워크보안 8항목 | 방화벽·분리·침입탐지·mTLS 패턴 포함 |
| FR-2.3-D11 | 가상화보안 7항목 | 컨테이너 격리·런타임 보안·이미지 무결성 패턴 포함 |
| FR-2.3-D12 | 개발보안 + MTU-C7 참조 | Policy as Code 연계 설명 포함 |
| FR-2.3-D13 | 공공기관추가보호조치 + MTU-C8 참조 | Harbor + Cosign 연계 + 행안부 고시 준수 설명 포함 |

---

## 합격 기준

1. 각 파일에 해당 분야 CSAP 항목 전수 포함 (D08 12개, D09 4개, D10 8개, D11 7개, D12 10개, D13 10개)
2. D08 RBAC 구현 패턴: TypeScript `verifyToken` + `hasPermission` 예시 코드 포함
3. D09 AES-256-GCM 저장 암호화 + TLS 1.3+ 전송 암호화 명시
4. D12 → MTU-C7 (`kyverno-policies.md`) 참조 링크 완비
5. D13 → MTU-C8 (`sigstore-signing.md`, `sbom-guide.md`) 참조 링크 완비
6. 각 항목: 증거 자료 목록 + 구현 예시 포함
7. `checklist-master.md#CSAP-D08~D13` 역참조 링크 완비
8. Auditor 에이전트 Q-GATE G6 통과

---

## 테스트 시나리오

**TS-C3-01**: 개발자가 D08 파일만으로 RBAC 구현 패턴 적용하여 API 엔드포인트 보호 1시간 이내 완료
**TS-C3-02**: D09 파일 기반 AES-256 암호화 + bcrypt 해시 적용 확인 (단위 테스트 통과)
**TS-C3-03**: D12 파일에서 MTU-C7 링크 클릭 → Kyverno 정책 적용 절차 확인 가능
**TS-C3-04**: D13 파일에서 MTU-C8 링크 클릭 → Cosign 이미지 서명 절차 확인 가능

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — D08~D13 구현 가이드 + MTU-C7/C8 연계 설계 | Claude Code |
| 0.2.0 | 2026-04-05 | P0-02: CSAP D10~D13 분야명/항목 수를 MTU-C1 기준으로 정합 (D10=네트워크보안 8항목, D11=가상화보안 7항목, D12=시스템개발보안 10항목, D13=공공기관추가보호조치 10항목) | CTO 팀 검토 |
| 0.3.0 | 2026-04-05 | P1: FR-2.3 → FR-2.3c (C2a=FR-2.3a, C2b=FR-2.3b와 충돌 해소) | Claude Code |
