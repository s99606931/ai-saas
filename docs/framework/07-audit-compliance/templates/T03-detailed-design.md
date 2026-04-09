# T03 상세설계서 템플릿

| 항목 | 내용 |
|------|------|
| 문서 ID | AUDIT-T03-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 감리 근거 | 행안부 정보화사업 감리기준 고시 제2023-1호 §7 |
| FR 매핑 | FR-4.3 |
| MTU 매핑 | MTU-A3a |
| 관련 문서 | [T01 사업계획서](T01-business-plan.md), [T02 요구사항정의서](T02-requirements.md), [T04 추적성 매트릭스](T04-traceability-matrix.md) |

<!-- Design Ref: MTU-A3a Plan -- 감리 산출물 T03 -->
<!-- Plan SC: 아키텍처+DB+API+보안 설계 4영역 완비 -->

---

> **[🔴 비즈니스 서비스 개발 시 필수 수정 항목]**
>
> 본 문서는 **프레임워크 기준 시스템 아키텍처 및 보안 설계**가 완비된 템플릿입니다. 실제 사업 적용 시:
> - **섹션 1 (아키텍처)**: 실제 서비스 레이어(민원 처리, 문서 결재 등) 추가
> - **섹션 2 (DB 설계)**: `[TODO]` ER 다이어그램 반드시 삽입 (Mermaid 또는 이미지) — **없으면 1차 감리 불통과**
> - **섹션 2 (테이블 정의)**: 실제 테이블 목록 및 컬럼 정의 기재
> - **섹션 3 (API)**: 실제 REST API 엔드포인트 전수 기재
> - **섹션 4 (보안 설계)**: 실제 RBAC 역할 목록 및 감사 이벤트 목록 기재
> - **{작성자}·{승인자}**: 실제 담당자 이름 기입
>
> ER 다이어그램 미작성은 감리기준 §7 위반으로 즉시 감리 결함 처리됩니다.

---

## 1. 시스템 아키텍처

### 1.1 전체 구성도

```
┌──────────────────────────────────────────────────────────────────┐
│                     공공 SaaS 프레임워크                           │
│                                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────────────────────────┐    │
│  │ 웹 UI   │   │ 공개 API│   │ AI API Gateway              │    │
│  │ (React) │   │ (REST)  │   │ (N2SF 등급별 라우팅)         │    │
│  └────┬────┘   └────┬────┘   └──────────┬──────────────────┘    │
│       │             │                    │                       │
│       └─────────────┼────────────────────┘                       │
│                     │                                            │
│  ┌──────────────────▼──────────────────────────────────┐         │
│  │              API 서버 (Node.js/TypeScript)           │         │
│  │  - JWT 인증 + RBAC (CSAP-D08)                       │         │
│  │  - Zod 입력 검증 (CSAP-D12)                          │         │
│  │  - 감사 로그 (CSAP-D06)                              │         │
│  └──────────────────┬──────────────────────────────────┘         │
│                     │                                            │
│       ┌─────────────┼────────────────┐                          │
│       ▼             ▼                ▼                          │
│  ┌─────────┐  ┌──────────┐    ┌───────────┐                    │
│  │ DB      │  │ LM Studio│    │ Claude API│                    │
│  │(암호화) │  │ (C/S등급)│    │ (O등급)   │                    │
│  └─────────┘  └──────────┘    └───────────┘                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              인프라 레이어                              │       │
│  │  k3s + Flux GitOps + Harbor + OTel + Prometheus       │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 네트워크 구성도 (N2SF C/S/O 등급 분리)

> **참조**: [N2SF 인프라 아키텍처](../../04-n2sf/n2sf-infrastructure-architecture.md) §2

| 네임스페이스 | N2SF 등급 | 외부 통신 | 내부 통신 |
|-----------|---------|---------|---------|
| grade-c | C (기밀) | 완전 차단 | C 내부만 |
| grade-s | S (민감) | 차단 | S 내부 + O→S 443 |
| grade-o | O (공개) | AI GW 443만 | O + S 허용 |
| monitoring | Infra | 차단 | 전체 수집 |

### 1.3 배포 구성도

> **참조**: [Flux GitOps 가이드](../../08-infra/flux-gitops-guide.md) §6

```
Gitea → Gitea Actions → Harbor(이미지+스캔+서명) → Flux → k3s
```

---

## 2. 데이터베이스 설계

### 2.1 ER 다이어그램

[TODO: 실제 ER 다이어그램을 Mermaid 또는 이미지로 삽입]

```
users ──┬── sessions
        ├── audit_logs
        └── user_roles ── roles ── permissions
```

### 2.2 테이블 명세

#### users 테이블

| 컬럼명 | 타입 | 제약 | 암호화 | 설명 |
|--------|------|------|--------|------|
| id | UUID | PK, NOT NULL | — | 사용자 고유 ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | AES-256 (D09) | 이메일 주소 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt(12) | 비밀번호 해시 |
| name | VARCHAR(100) | NOT NULL | AES-256 (D09) | 사용자 이름 (PII) |
| role_id | UUID | FK(roles.id) | — | 역할 참조 |
| created_at | TIMESTAMP | NOT NULL | — | 생성 일시 |
| updated_at | TIMESTAMP | NOT NULL | — | 수정 일시 |
| deleted_at | TIMESTAMP | NULLABLE | — | 소프트 삭제 |

#### audit_logs 테이블 (CSAP-D06)

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PK | 로그 고유 ID |
| actor_id | UUID | FK(users.id) | 행위자 |
| action | VARCHAR(50) | NOT NULL | 행위 유형 |
| target | VARCHAR(255) | NOT NULL | 대상 리소스 |
| ip_address | INET | NOT NULL | 클라이언트 IP |
| timestamp | TIMESTAMP | NOT NULL | 발생 시각 |
| details | JSONB | NULLABLE | 상세 정보 |

> **암호화 대상 컬럼**: email, name (PII) — AES-256-GCM (CSAP-D09-01)

### 2.3 인덱스 설계

| 테이블 | 인덱스 | 타입 | 용도 |
|--------|--------|------|------|
| users | idx_users_email | UNIQUE | 로그인 조회 |
| audit_logs | idx_audit_timestamp | B-tree | 시간 범위 조회 |
| audit_logs | idx_audit_actor | B-tree | 행위자별 조회 |

---

## 3. API 설계

### 3.1 엔드포인트 목록

| Method | Path | 설명 | 인증 | RBAC | CSAP |
|--------|------|------|------|------|------|
| POST | `/api/v1/auth/login` | 로그인 | 공개 | — | D08-01 |
| POST | `/api/v1/auth/logout` | 로그아웃 | JWT | 전체 | D08-01 |
| GET | `/api/v1/users` | 사용자 목록 | JWT | admin | D08-02 |
| GET | `/api/v1/users/:id` | 사용자 상세 | JWT | admin/self | D08-02 |
| POST | `/api/v1/ai/complete` | AI 완성 요청 | JWT | user+ | AI-REQ-1 |
| GET | `/api/v1/audit/logs` | 감사 로그 조회 | JWT | admin | D06-01 |
| GET | `/api/v1/health` | 헬스 체크 | 공개 | — | — |

### 3.2 인증·인가 흐름 (JWT + RBAC)

```
[클라이언트]
     │
     ├── POST /auth/login {email, password}
     │         ▼
     │   [서버] password 검증 (bcrypt)
     │         ▼
     │   JWT 발급 (access: 15분, refresh: 7일)
     │         ▼
     ├── Authorization: Bearer <access_token>
     │         ▼
     │   [미들웨어] JWT 검증 → 사용자 조회 → RBAC 검사
     │         ▼
     │   hasPermission(user, 'resource:action') ?
     │         ├── true → 비즈니스 로직 실행
     │         └── false → 403 Forbidden
     │
     ├── access_token 만료 시
     │         ▼
     │   POST /auth/refresh {refresh_token}
     │         ▼
     │   새 access_token 발급
```

### 3.3 에러 코드 표준

| HTTP | 코드 | 설명 | 응답 형식 |
|------|------|------|---------|
| 400 | BAD_REQUEST | 입력 검증 실패 | `{error, fieldErrors}` |
| 401 | UNAUTHORIZED | 인증 실패/만료 | `{error}` |
| 403 | FORBIDDEN | 권한 부족 | `{error}` |
| 404 | NOT_FOUND | 리소스 없음 | `{error}` |
| 429 | TOO_MANY_REQUESTS | 요청 제한 초과 | `{error, retryAfter}` |
| 500 | INTERNAL_ERROR | 서버 오류 | `{error, errorId}` |

> **보안 주의**: 500 에러 시 스택 트레이스·DB 정보 노출 금지 (CSAP-D12). `errorId`만 반환하고 상세는 서버 로그에만 기록.

---

## 4. 보안 설계

### 4.1 접근 통제 설계 (CSAP D-08)

| 역할 | 권한 | 설명 |
|------|------|------|
| admin | 전체 | 시스템 관리, 사용자 관리, 감사 로그 조회 |
| operator | 운영 | 서비스 운영, 모니터링 |
| user | 사용 | 일반 기능 사용, AI 요청 |
| viewer | 읽기 | 읽기 전용 |

### 4.2 암호화 설계 (CSAP D-09)

| 구분 | 알고리즘 | 용도 | 키 관리 |
|------|---------|------|--------|
| 저장 암호화 | AES-256-GCM | DB PII 컬럼 | 환경 변수 (ENCRYPTION_KEY) |
| 비밀번호 해시 | bcrypt(12) | 사용자 비밀번호 | salt 자동 생성 |
| 전송 암호화 | TLS 1.3 | 모든 HTTP 통신 | cert-manager 자동 갱신 |
| 이미지 서명 | Cosign (ECDSA) | 컨테이너 이미지 | 연간 키 교체 |

### 4.3 감사 로그 설계 (CSAP D-06)

```json
// audit.jsonl 스키마
{
  "timestamp": "ISO-8601",
  "actor": "user-id",
  "action": "ACTION_TYPE",
  "target": "resource-id",
  "ip": "client-ip",
  "result": "success|failure",
  "csapControl": "D06-XX",
  "details": {}
}
```

| 감사 대상 | action 값 | 보존 기간 |
|---------|---------|---------|
| 로그인/로그아웃 | AUTH_LOGIN/LOGOUT | 1년 |
| 사용자 생성/삭제 | USER_CREATE/DELETE | 1년 |
| 권한 변경 | PERMISSION_CHANGE | 1년 |
| AI 호출 | AI_ROUTE | 1년 |
| 데이터 삭제 | DATA_DELETE | 3년 |

### 4.4 AI 보안 게이트웨이 설계 (N2SF)

> **참조**: [N2SF 인프라 아키텍처](../../04-n2sf/n2sf-infrastructure-architecture.md) §4

| 데이터 등급 | 라우팅 대상 | PII 처리 | NetworkPolicy |
|---------|---------|---------|-------------|
| C (기밀) | LM Studio (로컬) | 처리 불필요 | grade-c 격리 |
| S (민감) | LM Studio (로컬) | 처리 불필요 | grade-s 제한 |
| O (공개) | Claude API (외부) | 마스킹 필수 | grade-o AI GW |

---

## 5. 인터페이스 설계

### 5.1 외부 연동 목록

| 연동 대상 | 프로토콜 | 데이터 형식 | 보안 | CSAP |
|---------|---------|---------|------|------|
| Claude API | HTTPS (REST) | JSON | TLS 1.3 + API Key | AI-REQ-1 |
| LM Studio | HTTP (localhost) | JSON | 로컬 통신 (N2SF N03) | AI-REQ-1 |

### 5.2 데이터 교환 형식

| 형식 | 용도 | 표준 |
|------|------|------|
| JSON | API 통신, 감사 로그 | RFC 8259 |
| SPDX JSON | SBOM | SPDX 2.3 |
| YAML | k8s 매니페스트, Flux 구성 | YAML 1.2 |

---

## 감리관 확인란

| 확인 항목 | 확인 | 비고 |
|---------|------|------|
| [ ] 아키텍처 구성도가 완비되었는가? | | |
| [ ] DB 설계가 완비되었는가? (ER, 테이블 명세, 인덱스) | | |
| [ ] API 설계가 완비되었는가? (엔드포인트, 인증, 에러) | | |
| [ ] CSAP D-08 접근 통제가 설계에 반영되었는가? | | |
| [ ] CSAP D-09 암호화가 설계에 반영되었는가? | | |
| [ ] CSAP D-06 감사 로그가 설계에 반영되었는가? | | |
| [ ] N2SF 데이터 등급별 네트워크 분리가 반영되었는가? | | |
| [ ] AI 보안 게이트웨이 라우팅이 설계에 반영되었는가? | | |

```
감리관: _________________  서명: _________________  일자: ____/____/____
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 아키텍처+DB+API+보안 4영역 설계 | Claude Code |
