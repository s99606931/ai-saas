# D12 시스템 개발 보안 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | CSAP-IMPL-D12 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| CSAP 분야 | D12 시스템 개발 보안 |
| 항목 수 | 10개 (CSAP-D12-01 ~ D12-10) |
| 통제 유형 | 기술/운영 통제 |
| 심사 방법 | 코드 리뷰 + 설정 확인 + 문서 확인 |
| 마스터 체크리스트 | [checklist-master.md#csap-d12-01](../checklist-master.md#csap-d12-01) |
| FR 매핑 | FR-2.3-D12 |

<!-- Design Ref: MTU-C3 Plan -- D12 시스템 개발 보안 -->
<!-- Plan SC: SAST/DAST + Zod 입력 검증 + MTU-C7 Policy as Code 연계 -->

---

## 분야 개요

시스템 개발 보안은 소프트웨어 **개발 수명 주기 전체에 보안을 내재화**하는 통제입니다. 입력 검증, 보안 코딩, 취약점 점검, 변경 관리, 패치 관리 등 개발부터 배포까지의 보안을 포괄합니다.

**핵심 키워드**: Zod 입력 검증, SAST/DAST, 보안 코딩, 변경 관리, OWASP, 이미지 서명

**연계 MTU**:
- MTU-C7 Policy as Code: Kyverno/OPA로 CSAP 통제 자동 적용
- MTU-C8 공급망 보안: 이미지 서명, SBOM, 취약점 스캔
- MTU-I2 Gitea CI/CD: SAST/DAST 파이프라인 통합

---

## CSAP-D12-01: 입력 데이터 검증

> **중요도**: 상 | **구분**: 필수

### 구현 목표

SQL 인젝션, XSS를 방지하기 위한 입력 검증을 적용한다.

### 구현 방법

**Zod 스키마 검증 (모든 API 입력)**

```typescript
// Zod 입력 검증 패턴 (CSAP-D12-01)
import { z } from 'zod'

// 사용자 생성 스키마
const createUserSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  name: z.string()
    .min(1, '이름은 1자 이상')
    .max(100, '이름은 100자 이하')
    .regex(/^[가-힣a-zA-Z\s]+$/, '이름에 특수문자 사용 불가'),
  role: z.enum(['admin', 'user', 'viewer']),
  phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '올바른 전화번호 형식').optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const result = createUserSchema.safeParse(body)

  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', fieldErrors: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const validated = result.data
  // 안전한 데이터로 비즈니스 로직 수행
}
```

**매개변수화 쿼리 (SQL 인젝션 방지)**

```typescript
// 매개변수화 쿼리 필수 (CSAP-D12-01)
const user = await db.execute(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [email, 'active']
)

// SQL 직접 결합 절대 금지
// const user = await db.execute(`SELECT * FROM users WHERE email = '${email}'`)  // BLOCKED
```

**XSS 방지 (HTML 새니타이제이션)**

```typescript
import DOMPurify from 'dompurify'

// 사용자 입력 HTML 새니타이제이션
const safeHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
  ALLOWED_ATTR: [],
})
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 코드 리뷰 결과 (입력 검증 확인) | PR 리뷰 | Gitea |
| Zod/Joi 스키마 코드 | 소스코드 | Git 저장소 |
| 입력 검증 로직 | 소스코드 | Git 저장소 |

---

## CSAP-D12-02: 보안 코딩 가이드

> **중요도**: 상 | **구분**: 필수

### 구현 목표

보안 코딩 가이드라인을 문서화하고 코드 리뷰 시 보안 점검을 수행한다.

### 구현 방법

**보안 코딩 체크리스트** (코드 리뷰 시 필수 확인)

| 번호 | 점검 항목 | 참조 |
|------|---------|------|
| 1 | 입력값 검증 (Zod/Joi) 적용 여부 | CSAP-D12-01 |
| 2 | 매개변수화 쿼리 사용 여부 | CSAP-D12-01 |
| 3 | 하드코딩 시크릿 없음 | CSAP-D12-05 |
| 4 | 에러 메시지에 내부 정보 미노출 | OWASP A01 |
| 5 | RBAC 권한 검사 적용 여부 | CSAP-D08-04 |
| 6 | 민감 데이터 암호화 저장 여부 | CSAP-D09-02 |
| 7 | 감사 로그 기록 여부 | CSAP-D06-03 |
| 8 | XSS 방지 새니타이제이션 적용 | CSAP-D12-01 |
| 9 | CSRF 토큰 적용 여부 | OWASP A05 |
| 10 | 안전한 에러 처리 (에러 ID 반환) | CSAP-D12-04 |

> 상세: `docs/framework/01-dev-standards/code-review-checklist.md` (MTU-F3)

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 보안 코딩 가이드 | PDF/문서 | 문서관리시스템 |
| 개발자 보안 교육 이력 | 교육 기록 | HR 시스템 |
| 코드 리뷰 체크리스트 | 문서 | Git 저장소 |

---

## CSAP-D12-03: 취약점 점검

> **중요도**: 상 | **구분**: 필수

### 구현 목표

정기 취약점 점검을 실시하고 OWASP Top 10에 대응한다.

### 구현 방법

| 도구 | 유형 | 적용 시점 | 대상 |
|------|------|---------|------|
| ESLint (security) | SAST | PR 생성 시 (CI/CD) | TypeScript/JavaScript |
| Trivy | 이미지 스캔 | 빌드 시 (CI/CD) | 컨테이너 이미지 |
| OWASP ZAP | DAST | 분기 1회 | 운영 서비스 |
| npm audit | 의존성 점검 | 일간 자동 | npm 패키지 |

**OWASP Top 10 (2021) 대응표**

| 순위 | 취약점 | 대응 조치 | 프레임워크 통제 |
|------|--------|---------|-------------|
| A01 | Broken Access Control | RBAC + 권한 검사 | CSAP-D08 |
| A02 | Cryptographic Failures | AES-256 + TLS 1.3 | CSAP-D09 |
| A03 | Injection | Zod 검증 + 매개변수화 쿼리 | CSAP-D12-01 |
| A04 | Insecure Design | STRIDE 위협 모델링 | CSAP-D12-02 |
| A05 | Security Misconfiguration | PSS restricted + CIS Benchmark | CSAP-D11 |
| A06 | Vulnerable Components | Trivy + npm audit | CSAP-D12-07 |
| A07 | Auth Failures | JWT + MFA + 세션 관리 | CSAP-D08 |
| A08 | Data Integrity Failures | 이미지 서명(Cosign) | CSAP-D11-06 |
| A09 | Logging Failures | audit.jsonl 전수 기록 | CSAP-D06 |
| A10 | SSRF | URL 화이트리스트 + 내부 IP 차단 | CSAP-D10 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 취약점 점검 보고서 (분기) | 보고서 | 문서관리시스템 |
| OWASP 점검 결과 | 보고서 | 보안 관리 |
| 조치 이력 | 기록 | 이슈 트래커 |

---

## CSAP-D12-04: 변경 관리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

시스템 변경 시 승인/테스트/배포 절차를 적용하고 롤백 절차를 수립한다.

### 구현 방법

```
변경 요청 → 영향 분석 → 승인 → 테스트 → 배포 → 검증 → (문제 시 롤백)
    │          │          │        │        │        │
    ▼          ▼          ▼        ▼        ▼        ▼
 PR 생성   Design 문서  리뷰어   Staging   Prod     헬스체크
           영향 범위    승인     환경 검증  배포     모니터링
```

**Gitea 기반 변경 관리**

| 단계 | 도구/방법 | 필수 조건 |
|------|---------|---------|
| 변경 요청 | PR 생성 (Gitea) | 변경 사유 + 영향 범위 기술 |
| 리뷰 | PR 리뷰 (최소 1인) | 보안 체크리스트 통과 |
| 테스트 | CI/CD 자동 테스트 | 테스트 통과 필수 |
| 승인 | PR 승인 (리뷰어) | 승인 없이 머지 금지 |
| 배포 | Flux GitOps 자동 배포 | Staging 검증 후 Prod |
| 롤백 | `git revert` + Flux 자동 | 5분 이내 롤백 가능 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 변경 관리 절차서 | PDF/문서 | 문서관리시스템 |
| 변경 이력 (PR 목록) | PR 기록 | Gitea |
| 승인 기록 | 리뷰 기록 | Gitea |
| 롤백 계획 | 문서 | 문서관리시스템 |

---

## CSAP-D12-05: 소스코드 보안 관리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

소스코드 접근을 통제하고 시크릿 하드코딩을 검출한다.

### 구현 방법

| 항목 | 구현 |
|------|------|
| 접근 통제 | Gitea 저장소 RBAC (읽기/쓰기/관리자) |
| 브랜치 보호 | main 브랜치 직접 푸시 금지, PR 필수 |
| 시크릿 검출 | git-secrets + pre-commit 훅 |
| 코드 서명 | GPG 서명 커밋 (선택적) |

```bash
# git-secrets: 하드코딩 시크릿 자동 검출
git secrets --install
git secrets --register-aws  # AWS 키 패턴 등록

# 커스텀 패턴 등록
git secrets --add 'password\s*=\s*["\x27][^"\x27]+'
git secrets --add 'api[_-]?key\s*=\s*["\x27][^"\x27]+'
git secrets --add 'sk-[a-zA-Z0-9]{32,}'

# pre-commit 훅에서 자동 실행
# ECC block-no-verify 훅과 연계
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 코드 저장소 접근 설정 | Gitea 설정 | Gitea 관리 |
| 시크릿 스캔 결과 | CI/CD 로그 | Gitea CI |
| 브랜치 보호 설정 | Gitea 설정 | Gitea 관리 |

---

## CSAP-D12-06: 개발/운영 환경 분리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

개발/스테이징/운영 환경을 분리하고 운영 데이터의 개발 환경 사용을 금지한다.

### 구현 방법

| 환경 | 네임스페이스 | 접근 대상 | 데이터 |
|------|-----------|---------|-------|
| Development | `dev` | 개발팀 전체 | 모의 데이터만 |
| Staging | `staging` | 개발팀 + QA | 모의 데이터만 |
| Production | `production` | 운영팀만 (VPN 필수) | 실 데이터 |

```yaml
# 환경별 네임스페이스 격리 (k3s)
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
    pod-security.kubernetes.io/enforce: restricted

---
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    environment: staging
    pod-security.kubernetes.io/enforce: restricted
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 환경 구성도 | 다이어그램 | 문서관리시스템 |
| 환경별 접근 권한 | RBAC 설정 | k3s 클러스터 |
| 데이터 분리 정책 | 문서 | 문서관리시스템 |

---

## CSAP-D12-07: 오픈소스 보안 관리

> **중요도**: 중 | **구분**: 필수

### 구현 목표

오픈소스 라이선스를 관리하고 알려진 취약점(CVE)을 점검한다.

### 구현 방법

```bash
# npm 의존성 취약점 점검 (일간 자동)
npm audit --audit-level=high

# SBOM 생성 (MTU-C8 연계)
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# 라이선스 호환성 점검
npx license-checker --production --failOn 'GPL-3.0'
```

> 상세 SBOM/CVE 관리: MTU-C8 [`08-infra/supply-chain/sbom-guide.md`](../../../08-infra/supply-chain/sbom-guide.md)

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| SBOM 목록 | JSON | Git/Harbor |
| 취약점 점검 결과 | npm audit 보고서 | CI/CD 아티팩트 |
| 라이선스 목록 | 표 | 문서관리시스템 |

---

## CSAP-D12-08: 패치 관리

> **중요도**: 상 | **구분**: 필수

### 구현 목표

보안 패치 적용 절차를 수립하고 긴급 패치를 기한 내 적용한다.

### 구현 방법

| 패치 유형 | 적용 기한 | 절차 |
|---------|---------|------|
| 긴급 (Critical CVE) | **7일 이내** | 즉시 분석 -> 테스트 -> 적용 |
| 중요 (High CVE) | 14일 이내 | 스케줄링 -> 테스트 -> 적용 |
| 일반 | 30일 이내 | 정기 패치 사이클에 포함 |
| OS/커널 | 월 1회 정기 | 정기 점검일에 적용 |

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 패치 관리 정책서 | PDF/문서 | 문서관리시스템 |
| 패치 적용 이력 | 기록 | 시스템 관리 |
| 미적용 패치 목록 | 표 | 보안 관리 |

---

## CSAP-D12-09: 보안 테스트

> **중요도**: 중 | **구분**: 필수

### 구현 목표

배포 전 보안 테스트를 수행하고 연 1회 모의해킹을 실시한다.

### 구현 방법

| 테스트 유형 | 도구 | 시점 | 주기 |
|---------|------|------|------|
| SAST (정적 분석) | ESLint security, Semgrep | CI/CD (PR 시) | 매 PR |
| DAST (동적 분석) | OWASP ZAP | 스테이징 배포 후 | 분기 1회 |
| 이미지 스캔 | Trivy | CI/CD (빌드 시) | 매 빌드 |
| 모의해킹 | 외부 전문기관 | 운영 환경 | 연 1회 |

```bash
# CI/CD 파이프라인 보안 테스트
# Step 1: SAST
npx eslint --ext .ts,.tsx src/ --config .eslintrc.security.json

# Step 2: 이미지 스캔
trivy image --severity HIGH,CRITICAL --exit-code 1 ${IMAGE}

# Step 3: 의존성 점검
npm audit --audit-level=high
```

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| 보안 테스트 결과 | 보고서 | CI/CD 아티팩트 |
| 모의해킹 보고서 (연 1회) | 보고서 | 문서관리시스템 |
| SAST/DAST 설정 | 설정 파일 | Git 저장소 |

---

## CSAP-D12-10: 안전한 배포

> **중요도**: 중 | **구분**: 필수

### 구현 목표

CI/CD 파이프라인 보안을 적용하고 배포 승인 절차와 이미지 무결성 검증을 수행한다.

### 구현 방법

```
코드 커밋 → CI 테스트 → 이미지 빌드 → 이미지 스캔 → 이미지 서명 → Staging 배포 → 승인 → Prod 배포
    │         │           │            │            │           │          │         │
    ▼         ▼           ▼            ▼            ▼           ▼          ▼         ▼
  Gitea    SAST+테스트   Docker     Trivy 통과    Cosign    자동 배포   리뷰어     Flux
  PR 생성   통과 필수     빌드       HIGH 0건     서명      검증       승인 필수   GitOps
```

> MTU-C7 Policy as Code 연계: Kyverno 정책으로 서명 없는 이미지 배포 자동 차단

```yaml
# Kyverno: 서명된 이미지만 배포 허용 (MTU-C7)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
    - name: verify-cosign
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "myregistry/*"
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      ...
                      -----END PUBLIC KEY-----
```

> 상세 정책 구성: MTU-C7 [`08-infra/policy-as-code/kyverno-policies.md`](../../../08-infra/policy-as-code/kyverno-policies.md)

### 필요 증거 자료

| 증거 | 형태 | 보관 위치 |
|------|------|---------|
| CI/CD 설정 | 설정 파일 | Gitea |
| 배포 승인 이력 | PR 기록 | Gitea |
| 이미지 서명 설정 (Cosign) | 설정 | Git 저장소 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- CSAP-D12 10항목 전수 구현 가이드. Zod + OWASP + Kyverno + Trivy 패턴. MTU-C7/C8 연계 | Claude Code |
