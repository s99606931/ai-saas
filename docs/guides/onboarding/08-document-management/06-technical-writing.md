# 기술 문서 작성 가이드 — 공공기관 SaaS 표준

> **문서 ID**: ONBOARD-08-DOC-06
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 문서를 처음 작성하는 개발자
> **선행 학습**: `08-document-management/standards/01-naming-conventions.md`
> **소요 시간**: 약 60분
> **참고 문서**: `CLAUDE.md`, `.claude/rules/harness-constraints.md`

---

## 목차

1. [공공기관 SaaS 문서 작성 원칙](#1-공공기관-saas-문서-작성-원칙)
2. [문서 유형별 작성 가이드](#2-문서-유형별-작성-가이드)
3. [Mermaid 다이어그램 작성 가이드](#3-mermaid-다이어그램-작성-가이드)
4. [코드 예시 작성 규칙](#4-코드-예시-작성-규칙)
5. [문서 품질 체크리스트](#5-문서-품질-체크리스트)
6. [기여 워크플로우](#6-기여-워크플로우)
7. [학습 체크리스트](#7-학습-체크리스트)
8. [다음 단계](#8-다음-단계)

---

## 1. 공공기관 SaaS 문서 작성 원칙

### 1.1 왜 공공기관 SaaS는 문서가 중요한가

민간 스타트업에서는 "코드가 문서"라는 말이 통하기도 합니다. 공공기관 SaaS에서는 통하지 않습니다.

**감리관은 코드를 읽지 않습니다.** 행안부 정보시스템 감리기준(고시 제2023-1호)에서 감리관은 문서를 기준으로 시스템이 요구사항을 충족하는지 검증합니다. 문서가 없으면 아무리 잘 만든 코드도 "미구현"으로 처리될 수 있습니다.

```
CLAUDE.md 절대 제약:
  "[필수] 구현 착수 전 Plan + Design 문서 완비 필수. 문서 없는 구현 = 감리 결함."
```

이 규칙은 단순한 형식 요건이 아닙니다. 감리 결함은 사업비 환수, 계약 해지로 이어질 수 있습니다.

### 1.2 핵심 원칙: "독자가 실행할 수 있어야 한다"

이 프로젝트의 모든 가이드 문서는 다음 기준을 충족해야 합니다.

```
독자가 문서를 읽고 직접 따라 할 수 있어야 한다.
  ❌ "인증 설정을 적절히 구성하십시오."
  ✅ "다음 환경 변수를 설정합니다: JWT_SECRET=..."

독자가 결과를 확인할 수 있어야 한다.
  ❌ "설치가 완료됩니다."
  ✅ "kubectl get pods -n linkerd 명령을 실행하면 모든 Pod가 Running 상태여야 합니다."

독자가 오류를 해결할 수 있어야 한다.
  ❌ "오류 발생 시 관리자에게 문의하십시오."
  ✅ "이 오류가 발생하면 다음을 확인합니다: ..."
```

### 1.3 한국어 표준 기술 용어 사용 규칙

이 프로젝트는 **한국어 전용**입니다 (`CLAUDE.md` 절대 제약). 기술 용어 표기 기준을 통일합니다.

| 원칙 | 설명 | 예시 |
|------|------|------|
| 영어 고유명사 유지 | 제품명, 프레임워크명 | Kubernetes, Prometheus, Loki |
| 동사는 한국어 | 기술 동작 설명 | "배포합니다", "확인합니다" |
| 약어 최초 1회 풀어쓰기 | 처음 등장할 때 전체 이름 표기 | "역할 기반 접근 제어(RBAC)" |
| 공공기관 표준 용어 사용 | 행안부 정보화 사업 용어 준수 | "정보시스템", "사용자 인증" |

```
✅ 올바른 예:
  "Linkerd 서비스 메시를 사용하여 서비스 간 전송 암호화(mTLS)를 적용합니다."

❌ 잘못된 예:
  "We use Linkerd service mesh to apply mTLS between services."
  (영어 사용 금지)

❌ 잘못된 예:
  "링커드 서비스 메쉬를 써서 엠티엘에스를 적용해요."
  (과도한 음역 + 비공식 어투)
```

### 1.4 행안부 감리 문서 형식 요건

모든 PDCA 문서(Plan, Design)에는 다음 섹션이 필수입니다.

```
필수 섹션 1: Executive Summary (4-Perspective 테이블)
  - 비즈니스 가치
  - 기술 구현
  - 보안/규제 충족
  - 운영 영향

필수 섹션 2: Context Anchor (5개 항목)
  - WHY: 이 작업을 하는 이유
  - WHO: 대상 독자/사용자
  - RISK: 구현하지 않을 때의 위험
  - SUCCESS: 성공 판단 기준 (측정 가능해야 함)
  - SCOPE: 포함/제외 범위

필수 섹션 3: 변경 이력 테이블
  - 버전, 일자, 내용, 작성자

필수 섹션 4: 추적성 매트릭스
  - FR ID ↔ 산출물 ↔ 테스트 ↔ CSAP 통제항목 4방향 연결
```

---

## 2. 문서 유형별 작성 가이드

### 2.1 Plan 문서 작성법

Plan 문서는 "무엇을, 왜, 어떻게 만들 것인가"를 정의합니다. 구현 착수 전에 완성해야 합니다.

**파일 위치**: `docs/01-plan/mtus/{MTU-ID}.plan.md`

**필수 구조:**

```markdown
# {MTU-ID}: {제목}

> **Plan SC**: {성공 기준 ID 목록}
> **버전**: 1.0.0 | **작성일**: YYYY-MM-DD | **작성자**: {역할}
> **관련 서비스**: {영향받는 서비스 목록}

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 이 기능이 제공하는 가치 |
| 기술 | 구현 방식 요약 |
| 보안 | CSAP/N2SF 충족 항목 |
| 운영 | 운영 부담 및 모니터링 |

## Context Anchor

- **WHY**: 이 MTU를 구현하는 이유 (문제 또는 기회)
- **WHO**: 이 기능의 수혜자 (테넌트, 관리자, 개발자 등)
- **RISK**: 구현하지 않을 때의 위험 (CSAP 위반, 장애 가능성 등)
- **SUCCESS**: 측정 가능한 성공 기준 (예: P95 응답 시간 200ms 이하)
- **SCOPE**: 포함 범위와 제외 범위

## 기능 요구사항 (FR)

| FR ID | 설명 | 우선순위 |
|-------|------|---------|
| FR-{모듈}.1 | ... | 필수 |

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP 항목 |
|-------|---------|--------|---------|
| FR-{모듈}.1 | `src/...` | `tests/...` | D-08-01 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | YYYY-MM-DD | 초기 작성 | {역할} |
```

**Executive Summary 작성 팁:**

```
❌ 나쁜 예:
  | 비즈니스 | 기능을 추가합니다. |
  (구체성 없음)

✅ 좋은 예:
  | 비즈니스 | 테넌트 관리자가 사용자를 일괄 초대할 수 있어 온보딩 시간 50% 단축 |
  (측정 가능한 가치)
```

### 2.2 Design 문서 작성법

Design 문서는 "어떻게 구현하는가"를 정의합니다. 코드 작성 전에 완성해야 합니다.

**파일 위치**: `docs/02-design/mtus/{MTU-ID}.design.md`

**API 명세 작성 형식:**

```markdown
## API 명세

### POST /api/v1/auth/login

**설명**: 사용자 로그인 및 JWT 토큰 발급

**요청**:
| 필드 | 유형 | 필수 | 설명 |
|------|------|------|------|
| email | string | 필수 | 사용자 이메일 |
| password | string | 필수 | 비밀번호 (최소 8자) |
| totpCode | string | 선택 | TOTP 코드 (MFA 활성화 시 필수) |

**응답 (200)**:
| 필드 | 유형 | 설명 |
|------|------|------|
| accessToken | string | JWT 접근 토큰 (15분 유효) |
| refreshToken | string | 갱신 토큰 (7일 유효) |

**에러 응답**:
| 상태 코드 | 에러 코드 | 설명 |
|---------|---------|------|
| 400 | INVALID_INPUT | 입력값 유효성 검사 실패 |
| 401 | INVALID_CREDENTIALS | 이메일 또는 비밀번호 불일치 |
| 429 | TOO_MANY_REQUESTS | 로그인 시도 횟수 초과 (CSAP D-08-06) |
```

**시퀀스 다이어그램 포함 필수 (서비스 간 통신이 있는 경우):**

```markdown
## 시퀀스 다이어그램

```mermaid
sequenceDiagram
  participant C as 클라이언트
  participant A as auth-service
  participant U as user-service
  participant R as Redis (세션)

  C->>A: POST /api/v1/auth/login
  A->>U: GET /api/v1/users/by-email
  U-->>A: 사용자 정보 반환
  A->>A: 비밀번호 bcrypt 검증
  A->>R: 세션 생성 (TTL 15분)
  A-->>C: 200 {accessToken, refreshToken}
```
```

**ERD 포함 필수 (새 DB 테이블 추가 시):**

```markdown
## 데이터 모델

```mermaid
erDiagram
  USERS {
    string id PK
    string email UK
    string passwordHash
    string tenantId FK
    datetime createdAt
  }
  SESSIONS {
    string id PK
    string userId FK
    string accessToken
    datetime expiresAt
  }
  USERS ||--o{ SESSIONS : "has"
```
```

### 2.3 가이드 문서 작성법 (이 문서가 속하는 유형)

가이드 문서는 개발자가 특정 작업을 수행할 수 있도록 단계별로 안내합니다.

**필수 구조:**

```
1. 메타 헤더 (문서 ID, 버전, 대상 독자, 선행 학습, 소요 시간)
2. 목차 (모든 섹션 링크 포함)
3. 배경 설명 (왜 이 작업이 필요한가)
4. 단계별 절차 (Step 1, Step 2...)
5. 코드 예시 (실행 가능한 코드)
6. 예상 결과 (정상 출력 예시)
7. 자주 발생하는 오류와 해결법
8. 학습 체크리스트
9. 다음 단계
```

**단계별 절차 작성 규칙:**

```markdown
### Step 1: 환경 변수 설정

다음 값을 `.env.local` 파일에 추가합니다.

```bash
# 필수 환경 변수
JWT_SECRET=your-secret-here-replace-this    # 임의의 32자 이상 문자열
DATABASE_URL=postgresql://localhost:5432/saas_db
```

설정 완료 후 서비스를 재시작합니다.

```bash
pnpm run dev --filter auth-service
```

**확인**: 다음 로그가 출력되면 정상입니다.

```
{"level":"info","message":"auth-service started","port":3001}
```
```

`**확인**` 섹션이 핵심입니다. 독자가 자신이 올바르게 따라했는지 알 수 있어야 합니다.

### 2.4 FAQ 작성법

FAQ는 반복적으로 묻는 질문과 답변입니다. 검색을 고려하여 질문을 자연어로 씁니다.

```markdown
## Q: JWT_SECRET 환경 변수를 설정하지 않으면 어떻게 됩니까?

서비스 시작 시 다음 에러와 함께 종료됩니다.

```
Error: JWT_SECRET 환경 변수 누락
```

이것은 의도된 동작입니다. CSAP D-12 요건에 따라 시크릿을 환경 변수 없이
하드코딩하는 것은 금지되어 있으며, 환경 변수가 없으면 서비스가 시작을
거부합니다. `.env.local` 파일에 `JWT_SECRET=...` 를 추가하십시오.
```

```
나쁜 FAQ 질문:
  Q: JWT_SECRET은 무엇입니까?   (너무 원론적)

좋은 FAQ 질문:
  Q: JWT_SECRET을 .env에 설정했는데 서비스가 "환경 변수 누락" 에러를 내면?
  (실제로 겪는 상황 묘사)
```

---

## 3. Mermaid 다이어그램 작성 가이드

### 3.1 다이어그램 유형 선택 기준

```mermaid
flowchart TD
    Q["무엇을 표현하고 싶은가?"]

    Q --> A["절차, 의사결정 흐름"]
    Q --> B["서비스 간 시간 순서 통신"]
    Q --> C["데이터 구조, DB 관계"]
    Q --> D["상태 변화 (현재 상태 → 다음 상태)"]
    Q --> E["프로젝트 일정, 마일스톤"]
    Q --> F["개념 관계, 마인드맵"]

    A --> FA["flowchart LR/TD\n(왼→오 또는 위→아래)"]
    B --> FB["sequenceDiagram"]
    C --> FC["erDiagram"]
    D --> FD["stateDiagram-v2"]
    E --> FE["gantt"]
    F --> FF["mindmap"]

    style FA fill:#e3f2fd
    style FB fill:#e8f5e9
    style FC fill:#fff3e0
    style FD fill:#fce4ec
    style FE fill:#f3e5f5
    style FF fill:#e0f2f1
```

### 3.2 flowchart — 절차와 의사결정

**언제**: 작업 흐름, 조건 분기, 시스템 구성 요소 관계를 보여줄 때.

```mermaid
flowchart LR
    subgraph 요청["사용자 요청"]
        REQ["POST /auth/login"]
    end

    subgraph 검증["검증 단계"]
        SCHEMA["Zod 스키마 검증"]
        RBAC["토큰 유효성 확인"]
    end

    subgraph 처리["비즈니스 로직"]
        DB["DB 사용자 조회"]
        HASH["bcrypt 검증"]
    end

    REQ --> SCHEMA
    SCHEMA -->|"유효"| RBAC
    SCHEMA -->|"실패"| ERR400["400 Bad Request"]
    RBAC --> DB
    DB --> HASH
    HASH -->|"일치"| OK200["200 + JWT"]
    HASH -->|"불일치"| ERR401["401 Unauthorized"]
```

소스 코드:

```
```mermaid
flowchart LR
    subgraph 요청["사용자 요청"]
        REQ["POST /auth/login"]
    end
    ...
```
```

**작성 팁:**
- `LR`: 왼쪽에서 오른쪽 (수평 흐름, 파이프라인 표현에 적합)
- `TD`: 위에서 아래 (계층 구조, 트리 표현에 적합)
- `subgraph`로 관련 노드 묶기
- 노드 레이블에 `\n`으로 줄 바꿈 가능

### 3.3 sequenceDiagram — 서비스 간 통신

**언제**: API 호출 순서, 인증 흐름, 이벤트 기반 통신을 보여줄 때.

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant GW as API 게이트웨이\n(Traefik)
    participant AUTH as auth-service
    participant USER as user-service

    C->>GW: POST /api/v1/auth/login
    GW->>AUTH: 요청 전달 (mTLS)
    AUTH->>USER: GET /users/by-email?email=...
    USER-->>AUTH: 사용자 정보 반환
    AUTH->>AUTH: bcrypt 검증
    AUTH-->>GW: 200 {accessToken}
    GW-->>C: 200 {accessToken}

    Note over AUTH,USER: Linkerd mTLS로 자동 암호화
```

소스 코드:

```
```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant AUTH as auth-service
    ...
    AUTH->>USER: GET /users/by-email?email=...  # 동기 요청
    USER-->>AUTH: 사용자 정보 반환               # 응답 (-->>는 점선)
    Note over AUTH,USER: Linkerd mTLS로 자동 암호화
```
```

**작성 팁:**
- `->>`: 실선 화살표 (요청)
- `-->>`: 점선 화살표 (응답, 비동기)
- `Note over A,B:`: A와 B 사이에 주석 박스
- `alt ... else ... end`: 조건 분기

### 3.4 erDiagram — 데이터 모델

**언제**: DB 테이블 구조, 엔티티 관계를 보여줄 때.

```mermaid
erDiagram
    TENANT {
        string id PK
        string name
        string plan
        datetime createdAt
    }
    USER {
        string id PK
        string email UK
        string passwordHash
        string tenantId FK
        boolean mfaEnabled
    }
    SESSION {
        string id PK
        string userId FK
        datetime expiresAt
        boolean revoked
    }
    TENANT ||--o{ USER : "소속"
    USER ||--o{ SESSION : "생성"
```

소스 코드:

```
```mermaid
erDiagram
    USER {
        string id PK    # PK = Primary Key
        string email UK # UK = Unique Key
        string tenantId FK  # FK = Foreign Key
    }
    TENANT ||--o{ USER : "소속"
    # || = 정확히 1, o{ = 0 이상 다수 (one-to-many)
```
```

**관계 기호 빠른 참조:**

| 기호 | 의미 |
|------|------|
| `\|\|` | 정확히 1 |
| `\|o` | 0 또는 1 |
| `o{` | 0 이상 (many) |
| `\|{` | 1 이상 (one or more) |

### 3.5 stateDiagram-v2 — 상태 머신

**언제**: 주문 상태, 인증 흐름, 배포 파이프라인 상태를 보여줄 때.

```mermaid
stateDiagram-v2
    [*] --> 대기중: 로그인 요청

    대기중 --> 검증중: 입력값 수신
    검증중 --> 인증실패: 비밀번호 불일치
    검증중 --> MFA확인: 비밀번호 일치 + MFA 활성화
    검증중 --> 인증성공: 비밀번호 일치 + MFA 비활성화
    MFA확인 --> 인증성공: OTP 코드 일치
    MFA확인 --> 인증실패: OTP 코드 불일치
    인증실패 --> 잠금: 5회 초과 실패 (CSAP D-08)
    인증성공 --> [*]
    잠금 --> [*]
```

### 3.6 gantt — 일정

**언제**: 스프린트 계획, 마일스톤, MTU 일정을 보여줄 때.

```
```mermaid
gantt
    title MTU-N251 DORA 메트릭 구현 일정
    dateFormat YYYY-MM-DD
    section 설계
    Plan 작성        :done, plan, 2026-04-01, 2026-04-02
    Design 작성      :done, design, 2026-04-02, 2026-04-03
    section 구현
    DORA Exporter   :active, impl1, 2026-04-03, 2026-04-07
    Grafana 대시보드 :impl2, 2026-04-07, 2026-04-09
    section 검증
    테스트           :test, 2026-04-09, 2026-04-10
    감리 검증        :audit, 2026-04-10, 2026-04-11
```
```

### 3.7 mindmap — 개념 지도

**언제**: 복잡한 개념의 전체 구조, 가이드 목차를 보여줄 때.

```
```mermaid
mindmap
  root((CSAP 보안 영역))
    D-06 침해사고 관리
      감사 로그 1년 보존
      이상 탐지 알림
      LogQL 분석
    D-08 접근 통제
      JWT 인증
      RBAC 권한
      계정 잠금
    D-09 암호화
      AES-256 저장 암호화
      mTLS 전송 암호화
    D-12 개발 보안
      Zod 입력 검증
      SQL 매개변수화 쿼리
      시크릿 환경 변수
```
```

---

## 4. 코드 예시 작성 규칙

### 4.1 언어 명시 필수

모든 코드 블록에 언어를 명시합니다. 문법 하이라이팅과 독자의 이해를 돕습니다.

```markdown
```typescript
// TypeScript 코드
```

```bash
# Shell 명령어
```

```yaml
# YAML 설정 파일
```

```logql
# Loki LogQL 쿼리
```

```sql
-- SQL 쿼리
```
```

### 4.2 동작하는 코드여야 한다

코드 예시는 실제로 실행하거나 그대로 복사하여 사용할 수 있어야 합니다.

```typescript
// ❌ 나쁜 예 — 실제 실행 불가
async function loginUser(data: LoginData) {
  // 여기서 검증하고
  // DB에서 찾아서
  // 토큰 반환
}

// ✅ 좋은 예 — 실제 실행 가능
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { db } from './db'
import { generateJwt } from './jwt'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

async function loginUser(data: unknown) {
  const validated = loginSchema.parse(data)
  const user = await db.user.findUnique({ where: { email: validated.email } })
  if (!user) throw new Error('사용자를 찾을 수 없습니다')
  const isValid = await bcrypt.compare(validated.password, user.passwordHash)
  if (!isValid) throw new Error('비밀번호가 올바르지 않습니다')
  return { accessToken: generateJwt(user) }
}
```

### 4.3 시크릿을 포함하지 않는다

```bash
# ❌ 절대 금지: 실제 시크릿 포함
export JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
export DATABASE_URL=postgresql://admin:SuperSecretPass123@prod-db:5432/saas

# ✅ 올바른 방법: 플레이스홀더 사용
export JWT_SECRET=your-secret-here-minimum-32-characters
export DATABASE_URL=postgresql://username:password@hostname:5432/database_name
```

### 4.4 주석은 최소화하고 코드로 설명한다

```typescript
// ❌ 코드가 자명한데 주석 추가 (불필요)
// 이메일을 소문자로 변환합니다
const normalizedEmail = email.toLowerCase()

// ✅ 이유(WHY)를 설명하는 경우만 주석 추가
// CSAP D-08-06: 5회 초과 실패 시 30분 잠금
const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 30 * 60 * 1000

// ✅ Design 문서 참조 주석 (추적성 확보)
// Design Ref: §3.2 — bcrypt cost factor 12 (OWASP 권장)
const BCRYPT_SALT_ROUNDS = 12
```

### 4.5 bash 명령어 예시 작성 규칙

```bash
# 1. 실행 결과 예시를 함께 보여줍니다
kubectl get pods -n saas-platform
# NAME                        READY   STATUS    RESTARTS   AGE
# auth-service-7d9b4f-xkz2p   2/2     Running   0          5d

# 2. 위험한 명령어는 경고를 먼저 표시합니다

# ⚠️ 이 명령은 데이터베이스를 초기화합니다. 운영 환경에서 실행 금지.
kubectl exec -n saas-platform deployment/postgres -- \
  psql -U saas_user -c "DROP TABLE IF EXISTS temp_migration;"

# 3. 긴 명령어는 \ 로 줄 바꿈합니다
kubectl run debug \
  --image=curlimages/curl:8.6.0 \
  --rm -it \
  --restart=Never \
  -- curl http://auth-service.saas-platform:3001/health
```

---

## 5. 문서 품질 체크리스트

### 5.1 작성 전 체크리스트

문서를 작성하기 전에 다음을 확인합니다.

- [ ] **독자 정의**: 이 문서를 읽을 사람이 누구인가? 선행 지식은 무엇인가?
- [ ] **목적 명확화**: 독자가 이 문서를 읽고 나서 할 수 있어야 하는 것은?
- [ ] **기존 문서 확인**: 비슷한 내용의 문서가 이미 있지는 않은가?
- [ ] **Plan/Design 연계**: 구현 문서라면 관련 Plan/Design 문서가 존재하는가?

### 5.2 작성 후 체크리스트

```
형식 체크:
  [ ] 메타 헤더 (문서 ID, 버전, 대상, 선행 학습, CSAP 참조) 포함
  [ ] 목차 포함 (모든 섹션 링크)
  [ ] 변경 이력 테이블 포함
  [ ] 학습 체크리스트와 다음 단계 포함

내용 체크:
  [ ] 모든 코드 블록에 언어 명시 (typescript, bash, yaml 등)
  [ ] 코드 예시가 실제로 실행 가능한가?
  [ ] 시크릿, 비밀번호, API 키가 포함되어 있지 않은가?
  [ ] 예상 결과(출력)가 코드 예시 아래에 있는가?
  [ ] 에러 케이스와 해결 방법이 포함되어 있는가?

CSAP 체크:
  [ ] CSAP 통제항목 참조가 정확한가? (예: D-06, D-08)
  [ ] 보안 관련 경고(⚠️)가 필요한 곳에 표시되어 있는가?
  [ ] PII 또는 시크릿을 포함하는 예시가 없는가?

언어 체크:
  [ ] 전체 한국어로 작성되었는가? (영어 고유명사 제외)
  [ ] 공공기관 표준 용어를 사용했는가?
  [ ] 비공식 어투(~해요, ~해봐요)가 없는가?
```

### 5.3 리뷰 기준

문서 PR을 검토할 때 다음 기준을 적용합니다.

| 기준 | 합격 | 불합격 |
|------|------|--------|
| 실행 가능성 | 코드 예시를 복사해서 실행하면 동작한다 | 예시가 작동하지 않거나 불완전하다 |
| 완전성 | 독자가 문서만 보고 작업을 완료할 수 있다 | 외부 지식이 없으면 막히는 부분이 있다 |
| 정확성 | 명시된 동작이 실제 코드와 일치한다 | 코드와 문서 내용이 다르다 |
| 보안 | 시크릿, PII, 취약한 패턴이 없다 | 하드코딩된 값이나 안전하지 않은 예시가 있다 |

---

## 6. 기여 워크플로우

### 6.1 문서 PR 절차

문서 변경은 코드 변경보다 간소한 리뷰를 적용합니다.

```mermaid
flowchart LR
    A["문서 수정\n또는 신규 작성"] --> B["브랜치 생성\ndocs/{설명}"]
    B --> C["PR 생성\n제목: docs({범위}): {설명}"]
    C --> D{"리뷰어\n1명 승인"}
    D -->|승인| E["main 머지"]
    D -->|수정 요청| F["수정 후 재요청"]
    F --> D

    style E fill:#4caf50,color:#fff
```

```bash
# 문서 브랜치 생성 예시
git checkout -b docs/08-technical-writing-guide

# 커밋 메시지 형식
git commit -m "docs(onboarding): 08-document-management 기술 문서 작성 가이드 추가"

# PR 제목 형식
"docs(onboarding): 기술 문서 작성 가이드 신규 작성"
```

**코드 PR과의 차이:**
- 코드 PR: 리뷰어 1명 + Reviewer 에이전트 자동 검사 (Q-GATE G1~G7)
- 문서 PR: 리뷰어 1명만으로 머지 가능 (Q-GATE 생략)

단, 다음 문서는 코드 PR과 동일한 절차가 필요합니다.
- Plan 문서 (`docs/01-plan/`) → 구현 착수의 근거이므로 엄격 검토
- Design 문서 (`docs/02-design/`) → API 계약이므로 엄격 검토

### 6.2 문서 오류 신고 방법

문서에 오류를 발견하면 다음 방법으로 신고합니다.

**방법 1: Gitea Issue 생성 (권장)**

```
제목: [DOC BUG] {문서 경로} — {오류 내용 한 줄 요약}
예시: [DOC BUG] 05-monitoring/logging/01-loki-guide.md — LogQL rate() 쿼리 시간창 오류

내용:
  - 문서 경로: docs/guides/onboarding/05-monitoring/...
  - 잘못된 내용: (스크린샷 또는 인용)
  - 올바른 내용: (수정 제안)
  - 발견일: 2026-04-12
```

**방법 2: 직접 수정 후 PR**

오류가 명확하고 수정이 간단하면 직접 수정하여 PR을 올립니다.

```bash
# 오류 수정 브랜치
git checkout -b fix/docs-loki-guide-rate-query

# 커밋
git commit -m "fix(docs): 05-monitoring loki-guide rate() 쿼리 시간창 오류 수정"
```

### 6.3 문서 폐기 절차

더 이상 유효하지 않은 문서는 즉시 삭제합니다. 공공기관 감리에서 오래된 문서는 "잘못된 현황"으로 처리될 수 있습니다.

```bash
# 문서 폐기 예시
git rm docs/guides/onboarding/deprecated-guide.md
git commit -m "docs: deprecated-guide 폐기 — v2.0으로 대체됨 (PR #123 참조)"
```

폐기 시 해당 문서를 참조하는 다른 문서에서 링크를 제거하거나 업데이트합니다.

---

## 7. 학습 체크리스트

### 원칙 이해

- [ ] 공공기관 SaaS에서 문서가 코드보다 먼저 완성되어야 하는 이유를 설명할 수 있다
- [ ] "독자가 실행할 수 있어야 한다" 원칙에 위배되는 문서 예시를 들 수 있다
- [ ] Plan 문서와 Design 문서의 차이와 각각이 필요한 시점을 설명할 수 있다

### 실습

- [ ] Plan 문서의 Executive Summary 테이블을 한 줄씩 채워 보았다
- [ ] sequenceDiagram으로 API 호출 흐름을 그려 보았다 (VSCode Mermaid 플러그인 사용)
- [ ] 실행 가능한 TypeScript 코드 예시를 포함한 문서 섹션을 작성했다
- [ ] 섹션 5의 작성 후 체크리스트를 적용하여 기존 문서의 개선 사항을 찾았다

### 기여

- [ ] 문서 PR 브랜치명 규칙(`docs/{설명}`)을 따라 브랜치를 생성할 수 있다
- [ ] Gitea Issue를 올바른 형식으로 작성할 수 있다

---

## 8. 다음 단계

기술 문서 작성 가이드를 완료했습니다. 실제 문서 작성에 바로 적용합니다.

**문서 작성 연습:**
- `08-document-management/pdca/02-writing-plan.md` — Plan 문서 작성 실습 (템플릿 포함)
- `08-document-management/pdca/03-writing-design.md` — Design 문서 작성 실습

**표준 확인:**
- `08-document-management/standards/02-review-standards.md` — 코드 리뷰 기준
- `08-document-management/mtu-system/02-mtu-templates.md` — MTU 템플릿 모음

**실제 문서 기여:**
- `13-contributing.md` — 프로젝트 기여 전체 가이드 (코드 + 문서)

---

> **참조 파일**:
> - `/data/ai-saas/CLAUDE.md` — 프로젝트 하네스 (언어 정책, 문서 형식 요건)
> - `.claude/rules/harness-constraints.md` — 코딩·문서 스타일 규칙
> - `docs/guides/onboarding/08-document-management/standards/01-naming-conventions.md` — 명명 규칙 전체 가이드
>
> **감리 기준 참조**: 행안부 정보시스템 감리기준 고시 제2023-1호 — 산출물 목록 및 형식 요건

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 초기 작성 | Implementer (Sonnet) |
