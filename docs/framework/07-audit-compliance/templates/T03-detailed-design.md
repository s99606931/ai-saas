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

## 6. CI/CD 파이프라인 아키텍처 (MTU-N37~N88)

<!-- Design Ref: MTU-N89 Design §1 — CI/CD 아키텍처 확장 -->
<!-- Plan SC: FR-N89.1 -->

### 6.1 공급망 보안 계층

| 구성요소 | 기능 | CSAP 매핑 | MTU |
|---------|------|----------|-----|
| Syft SBOM 생성 | 빌드 시 SPDX JSON SBOM 자동 생성 | D-05-02 | N37 |
| Grype 취약점 스캔 | SBOM 기반 CVE 스캔 + CRITICAL 차단 | D-05-01 | N37 |
| SLSA Level 3 | 빌드 Provenance 증명 생성 | D-12-08 | N46 |
| Cosign 이미지 서명 | 컨테이너 이미지 무결성 서명 + 검증 | D-09-04 | N27 |
| S2C2F Level 3 | 공급망 보안 성숙도 프레임워크 | D-05 | N80 |
| Renovate Bot | 의존성 자동 업데이트 PR 생성 | D-05-03 | N79 |
| CVE 자동 패치 | CRITICAL/HIGH CVE 발견 시 자동 패치 PR | D-05-01 | N81 |

### 6.2 배포 자동화 계층

| 구성요소 | 기능 | CSAP 매핑 | MTU |
|---------|------|----------|-----|
| Flux GitOps | Git 소스 기반 클러스터 상태 동기화 | D-12-06 | I3, N24 |
| Flagger 카나리 | 점진적 트래픽 전환 (10%->50%->100%) | D-12-07 | N40 |
| 멀티환경 GitOps | dev/stg/prod 환경 분리 배포 | D-12-06 | N41 |
| Sealed Secrets | GitOps 호환 시크릿 암호화 | D-09-01 | N39 |
| External Secrets | 외부 시크릿 저장소 연동 | D-09-01 | N66 |
| vCluster Preview | PR별 격리 환경 자동 생성/삭제 | D-12-09 | N73 |
| Semantic Release | 자동 버전 관리 + CHANGELOG 생성 | D-12-10 | N42 |

### 6.3 관측성 계층 (4대 신호)

| 신호 | 구성요소 | 기능 | MTU |
|------|---------|------|-----|
| 메트릭 | Prometheus + Recording Rules | 시계열 메트릭 수집 + 집계 | N57 |
| 메트릭 | VPA + OpenCost | 리소스 Right-Sizing + 비용 분석 | N72 |
| 메트릭 | SLO/SLI (Sloth) | 서비스 수준 목표 자동화 | N49 |
| 로그 | Loki + LogQL | 구조화 로그 수집 + 고급 쿼리 | N69 |
| 트레이스 | Tempo + OTel + TraceQL | 분산 추적 + 서비스 맵 | N48, N69 |
| 프로파일 | Pyroscope | 연속 CPU/메모리 프로파일링 | N82 |
| 대시보드 | Grafana 특화 대시보드 | 공공 SaaS 전용 시각화 | N61 |
| 이상탐지 | Z-Score + Prophet ML | 자동 이상 패턴 탐지 | N83 |

### 6.4 보안 계층

| 구성요소 | 기능 | CSAP 매핑 | MTU |
|---------|------|----------|-----|
| Falco | 런타임 위협 탐지 (시스템콜 모니터링) | D-06-03 | N45 |
| PSS Restricted | Pod 보안 표준 최고 수준 적용 | D-08-10 | N71 |
| Trivy Operator | 클러스터 전체 보안 스캔 (이미지+설정) | D-05-01 | N63 |
| Admission Webhook | 커스텀 보안 검증 5종 | D-08-11 | N75 |
| Kyverno Enforce | 정책 위반 차단 모드 | D-08-09 | N31 |
| Gatekeeper | OPA 기반 정책 관리 | D-08-09 | N53 |
| NetworkPolicy | 네임스페이스 간 트래픽 격리 | D-10-01 | N28 |
| cert-manager | TLS 인증서 자동 발급/갱신 | D-09-02 | N62 |
| Linkerd mTLS | 서비스 간 상호 TLS 암호화 | D-09-03 | N54 |

### 6.5 안정성 계층

| 구성요소 | 기능 | MTU |
|---------|------|-----|
| 카오스 엔지니어링 (Litmus) | 장애 주입 테스트 자동화 | N50 |
| SRE Runbook 10종 | 장애 대응 자동화 (황금 신호 기반) | N74 |
| DR 자동 페일오버 (Velero) | 재해 복구 백업/복원 자동화 | N55, N87 |
| KEDA 오토스케일 | 이벤트 기반 자동 확장/축소 | N56 |
| Flux Drift Detection | 클러스터 상태 드리프트 자동 탐지 | N47, N67 |
| 용량 계획 + ResourceQuota | 리소스 용량 예측 + 3등급 할당 | N76 |

### 6.6 CI/CD 파이프라인 전체 흐름

```
[개발자]
  │
  ├── git push → Gitea
  │                │
  │                ├── Gitea Actions 트리거
  │                │     ├── 1. 린트 + 단위 테스트
  │                │     ├── 2. Syft SBOM 생성
  │                │     ├── 3. Grype 취약점 스캔 (CRITICAL=차단)
  │                │     ├── 4. Docker 빌드 + Harbor 푸시
  │                │     ├── 5. Cosign 이미지 서명
  │                │     ├── 6. SLSA Provenance 생성
  │                │     └── 7. Semantic Release + CHANGELOG
  │                │
  │                └── Flux 감지 → k3s 배포
  │                      ├── Kyverno 정책 검증
  │                      ├── Admission Webhook 보안 검사
  │                      ├── Flagger 카나리 배포
  │                      └── SLO 기반 자동 롤백
  │
  └── 모니터링
        ├── Prometheus 메트릭 수집
        ├── Loki 로그 수집
        ├── Tempo 트레이스 수집
        ├── Pyroscope 프로파일 수집
        ├── Falco 런타임 보안 감시
        └── ML 이상탐지 알림
```

---

## 7. 인프라 컴포넌트 목록 (37개)

| # | 컴포넌트 | 버전 | 용도 | 네임스페이스 |
|---|---------|------|------|------------|
| 1 | k3s | v1.30+ | 경량 Kubernetes | - |
| 2 | Gitea | 1.22+ | Git 호스팅 + CI/CD | gitea |
| 3 | Harbor | 2.10+ | 컨테이너 레지스트리 + 스캔 | harbor |
| 4 | Flux | v2.3+ | GitOps 컨트롤러 | flux-system |
| 5 | Flagger | 1.37+ | 카나리 배포 | flagger-system |
| 6 | Falco | 0.38+ | 런타임 보안 | falco |
| 7 | Litmus | 3.8+ | 카오스 엔지니어링 | litmus |
| 8 | OTel Collector | 0.96+ | 텔레메트리 수집 | monitoring |
| 9 | Tempo | 2.4+ | 분산 트레이스 저장소 | monitoring |
| 10 | Grafana | 10.3+ | 관측성 대시보드 | monitoring |
| 11 | Prometheus | 2.51+ | 메트릭 저장소 | monitoring |
| 12 | Loki | 2.9+ | 로그 저장소 | monitoring |
| 13 | cert-manager | 1.14+ | TLS 인증서 자동화 | cert-manager |
| 14 | Trivy Operator | 0.19+ | 클러스터 보안 스캔 | trivy-system |
| 15 | CloudNativePG | 1.22+ | PostgreSQL 오퍼레이터 | cnpg-system |
| 16 | Traefik | 3.0+ | 인그레스 + Gateway API | traefik |
| 17 | External Secrets | 0.9+ | 외부 시크릿 관리 | external-secrets |
| 18 | Kyverno | 1.11+ | 정책 관리 (Enforce) | kyverno |
| 19 | Sealed Secrets | 0.26+ | GitOps 시크릿 암호화 | kube-system |
| 20 | Sloth | 0.11+ | SLO/SLI 자동화 | monitoring |
| 21 | MinIO | 2024+ | 오브젝트 스토리지 | minio |
| 22 | Velero | 1.13+ | 백업/복원 | velero |
| 23 | Policy Reporter | 2.18+ | 정책 위반 보고 | policy-reporter |
| 24 | VPA | 1.0+ | 수직 Pod 오토스케일러 | kube-system |
| 25 | OpenCost | 1.10+ | 비용 모니터링 | opencost |
| 26 | vCluster | 0.19+ | 가상 클러스터 (PR Preview) | vcluster |
| 27 | KEDA | 2.13+ | 이벤트 기반 오토스케일 | keda |
| 28 | Gatekeeper | 3.15+ | OPA 정책 관리 | gatekeeper-system |
| 29 | Linkerd | 2.14+ | 서비스 메시 + mTLS | linkerd |
| 30 | Pyroscope | 1.4+ | 연속 프로파일링 | monitoring |
| 31 | Renovate Bot | 37+ | 의존성 자동 업데이트 | gitea |
| 32 | Admission Webhook | custom | 보안 검증기 5종 | webhook |
| 33 | Cosign | 2.2+ | 이미지 서명/검증 | (CI 도구) |
| 34 | Syft/Grype | 1.0+ | SBOM/취약점 스캔 | (CI 도구) |
| 35 | Prophet ML | custom | 이상탐지 | monitoring |
| 36 | CSAP Collector | custom | 증거 자동 수집 | compliance |
| 37 | ResourceQuota Mgr | custom | 용량 관리 3등급 | kube-system |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 아키텍처+DB+API+보안 4영역 설계 | Claude Code |
| 2.0.0 | 2026-04-10 | CI/CD 파이프라인 아키텍처 (6장), 인프라 컴포넌트 37개 목록 (7장) 추가 — MTU-N89 | PM Agent |
