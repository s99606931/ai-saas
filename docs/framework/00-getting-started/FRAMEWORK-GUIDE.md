# 공공기관 SaaS 프레임워크 문서 안내서

| 항목 | 내용 |
|------|------|
| 문서 ID | FW-GUIDE-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | 프레임워크 사용 전 직군 (CTO, PM, 개발자, 보안 담당자, 감리 담당자) |
| 목적 | 100개 프레임워크 문서의 목적·활용 방법·감리/CSAP 제출 기준 통합 안내 |
| 관련 문서 | [README.md](README.md), [AUDIT-CSAP-SUBMISSION-GUIDE.md](AUDIT-CSAP-SUBMISSION-GUIDE.md) |

---

## 목적

본 문서는 **공공기관 SaaS 프레임워크** 내 100개 문서 각각의:

- **목적**: 무엇을 위한 문서인가
- **활용 시점**: 언제 사용하는가
- **감리/CSAP 활용**: 인증·감리 시 어떻게 사용하는가
- **완성도 상태**: 현재 상태 및 비즈니스 서비스 개발 후 수정 필요 여부

를 통합하여 안내합니다. 감리 대응 및 CSAP 인증 취득 시 이 문서를 **최초 참조점**으로 활용하십시오.

---

## 1. 프레임워크 문서 전체 지도

### 1.1 목적별 문서 분류

| 목적 | 디렉토리 | 문서 수 | 핵심 용도 |
|------|---------|--------|---------|
| **시작 가이드** | `00-getting-started/` | 4 | 역할별 진입점, 사전 요건 |
| **개발 표준** | `01-dev-standards/` | 4 | 코딩 스타일, 문서 템플릿, 리뷰 기준 |
| **CSAP 인증** | `02-csap/` | 16 | CSAP 일반·표준등급 체크리스트, D01~D13 구현 가이드 |
| **N2SF 보안** | `03-n2sf/` | 8 | 데이터 등급 분류, 6개 영역 통제, CSAP 매핑 |
| **ISMS-P** | `04-isms-p/` | 10 | 101항목 체크리스트, 증적 자동화, 2027 의무화 대비 |
| **감리 산출물 T01~T02** | `05-audit-docs/` | 2 | 사업계획서, 요구사항정의서 (원본 참조) |
| **감리 산출물 T03~T07** | `06-audit-compliance/` | 8 | 설계서, 테스트, 추적성, 결함관리대장, 감리 체크리스트 |
| **인프라** | `07-infra/` | 20 | k3s, GitOps, CI/CD, Harbor, 네트워크 정책, OTel |
| **AI 연동** | `08-ai-integration/` | 5 | AI 보안 게이트웨이, LM Studio, MCP, 데이터 마스킹 |
| **CC 하네스** | `09-cc-harness/` | 1 | Claude Code 하네스 검증 절차 |
| **멀티테넌시** | `10-multitenancy/` | 3 | 테넌트 격리, 온보딩 자동화 |
| **문서 포털** | `11-documentation-portal/` | 2 | Docusaurus 설치, 콘텐츠 구성 |
| **준수 대시보드** | `12-compliance-dashboard/` | 2 | Grafana CSAP/N2SF 실시간 현황 |
| **버전 관리** | `14-framework-upgrade/` | 2 | 업그레이드 절차, 버전 관리 가이드 |
| **참조** | `99-references/` | 4 | 외부 규정 인덱스, 용어 사전, OSCAL |
| **합계** | — | **91** | — |

### 1.2 감리/CSAP 관련도별 분류

| 관련도 | 설명 | 해당 디렉토리 |
|--------|------|-------------|
| **감리 필수 제출** | 행안부 고시 §5~§8에 따른 필수 산출물 | `05-audit-docs/`, `06-audit-compliance/templates/` |
| **CSAP 직접 증거** | CSAP 심사관에게 증거 자료로 제출 가능 | `02-csap/`, `03-n2sf/`, `08-ai-integration/` |
| **CSAP 구현 근거** | CSAP 통제항목 구현 방법 설명 | `07-infra/`, `01-dev-standards/` |
| **ISMS-P 증거** | 2027 의무화 대비 | `04-isms-p/` |
| **내부 운영** | 팀 내부 운영 도구 | `09-cc-harness/`, `11~12/`, `14/` |

---

## 2. 카테고리별 문서 상세 설명

---

### 2.1 `00-getting-started/` — 시작 가이드 (4개 문서)

**목적**: 프레임워크 신규 사용자가 15분 이내에 본인 역할에 맞는 경로를 찾도록 안내

| 파일명 | 문서 ID | 목적 | 활용 시점 | 감리/CSAP 제출 | 비즈니스 수정 필요 |
|--------|---------|------|---------|:------------:|:--------------:|
| `README.md` | FW-README | 프레임워크 전체 구조, 역할별 진입점, Phase 로드맵 | 사업 시작 전 | × | ○ |
| `quick-start.md` | FW-QUICKSTART | 역할별(CTO/PM/개발자) 15분 경로 안내 | 사업 시작 전 | × | × |
| `prerequisites.md` | FW-PREREQ | 기술 사전 요건 체크리스트 | 환경 구성 전 | × | △ |
| `FRAMEWORK-GUIDE.md` | FW-GUIDE-001 | **본 문서** — 전체 문서 안내 및 감리/CSAP 활용 가이드 | 감리·인증 준비 시 | × | × |

**감리/CSAP 활용 방법**:
- `README.md`는 감리관에게 **프레임워크 전체 구조를 설명**할 때 활용
- CSAP 심사 시 "클라우드 서비스 보안 체계 문서화" 증거로 활용 가능

**비즈니스 서비스 개발 후 수정 필요 사항**:
- `README.md`: MTU 상태 ('완료'/'진행 중'/'미착수') 최신화

---

### 2.2 `01-dev-standards/` — 개발 표준 (4개 문서)

**목적**: 프레임워크 전체에서 일관된 코딩·문서화 표준을 정의하여 CSAP D-12 요건 충족

| 파일명 | 문서 ID | 목적 | 활용 시점 | 감리/CSAP 제출 |
|--------|---------|------|---------|:------------:|
| `coding-style-guide.md` | DEV-CODESTYLE | TypeScript/Python 코딩 규칙, 보안 패턴, Dead Code 정책 | 개발 착수 전 | CSAP D-12 증거 △ |
| `doc-type-templates.md` | DEV-DOCTYPES | 문서 유형별(Plan/Design/Report) 표준 템플릿 | 문서 작성 시 | 감리 보조 자료 △ |
| `requirement-id-system.md` | DEV-REQID | FR/NFR/INFR/AI-REQ/CC-REQ ID 체계 정의 | 요구사항 작성 시 | 감리 T02 근거 ○ |
| `review-checklist.md` | DEV-REVIEW | PR 코드리뷰 체크리스트, OWASP Top 10 항목 | 코드 리뷰 시 | CSAP D-12 증거 △ |

**감리/CSAP 활용 방법**:
- `coding-style-guide.md`: CSAP D-12 "시스템 개발 보안" 항목의 **시큐어 코딩 기준 문서**로 제출
- `requirement-id-system.md`: 감리 T02·T04 작성 시 ID 체계 근거 문서로 참조
- `review-checklist.md`: CSAP D-12-07 "보안성 검토" 증거로 활용

**비즈니스 서비스 개발 후 수정 필요 사항**:
- `coding-style-guide.md`: 실제 사용 프레임워크(React, Spring Boot 등)에 맞춘 규칙 추가

---

### 2.3 `02-csap/` — CSAP 인증 (16개 문서)

**목적**: CSAP 일반등급(30항목) 및 표준등급(79항목) 자가진단 및 구현 가이드

#### 2.3.1 일반등급 (`simple-grade/`)

| 파일명 | 문서 ID | 목적 | CSAP 제출 |
|--------|---------|------|:--------:|
| `checklist-simple.md` | CSAP-SIMPLE-CHK | 30개 핵심 항목 자가진단 체크리스트 | ○ 직접 제출 |
| `quick-start-guide.md` | CSAP-SIMPLE-QS | 일반등급 빠른 시작, 3등급 비교 | 참조 자료 |

**활용 시점**: CSAP 일반등급 신청 전 3일 자가진단 → 30항목 전수 체크 완료 → KISA 심사 신청

#### 2.3.2 표준등급 (`standard-grade/`)

| 파일명 | 문서 ID | 목적 | CSAP 제출 |
|--------|---------|------|:--------:|
| `checklist-master.md` | CSAP-STD-MASTER | 표준등급 79항목 전수 마스터 체크리스트 | ○ 핵심 제출 |
| `implementation-guide/D01-policy.md` | CSAP-D01 | 정보보호 정책 4항목 구현 가이드 + 증거 목록 | 증거 자료 |
| `implementation-guide/D02-org-security.md` | CSAP-D02 | 조직 보안 3항목 구현 가이드 | 증거 자료 |
| `implementation-guide/D03-personnel.md` | CSAP-D03 | 인적 보안 4항목 구현 가이드 | 증거 자료 |
| `implementation-guide/D04-asset-mgmt.md` | CSAP-D04 | 자산 관리 5항목 구현 가이드 | 증거 자료 |
| `implementation-guide/D05-supply-chain.md` | CSAP-D05 | 공급망 보안 4항목 구현 가이드 | 증거 자료 |
| `implementation-guide/D06-incident.md` | CSAP-D06 | 침해사고 관리 5항목 구현 가이드 | 증거 자료 |
| `implementation-guide/D07-disaster-recovery.md` | CSAP-D07 | 재해복구 4항목 구현 가이드 | 증거 자료 |
| `implementation-guide/D08-access-control.md` | CSAP-D08 | 접근 통제 12항목 구현 가이드 | ○ 주요 증거 |
| `implementation-guide/D09-encryption.md` | CSAP-D09 | 암호화 4항목 구현 가이드 | ○ 주요 증거 |
| `implementation-guide/D10-network-security.md` | CSAP-D10 | 네트워크 보안 8항목 구현 가이드 | ○ 주요 증거 |
| `implementation-guide/D11-virtualization-security.md` | CSAP-D11 | 가상화 보안 7항목 구현 가이드 | ○ 주요 증거 |
| `implementation-guide/D12-system-dev-security.md` | CSAP-D12 | 시스템 개발 보안 10항목 구현 가이드 | ○ 주요 증거 |
| `implementation-guide/D13-public-agency-additional.md` | CSAP-D13 | 공공기관 추가 보호조치 10항목 | ○ 필수 제출 |

**CSAP 표준등급 심사 대응 방법**:
1. `checklist-master.md`로 79항목 자가진단 → 미충족 항목 식별
2. 미충족 항목의 해당 `D0X.md` 구현 가이드에서 증거 자료 준비
3. 각 구현 가이드의 "증거 자료" 목록 대로 파일 수집
4. KISA 심사관에게 `checklist-master.md` + 증거 파일 패키지 제출

**비즈니스 서비스 개발 후 수정 필요 사항**:
- `checklist-master.md`: 실제 구현 완료 항목에 체크(v) 표시 — **KISA 제출 전 필수**
- `D01-policy.md` ~ `D13.md`: 실제 증거 파일 경로 기입 — **심사 전 필수**

---

### 2.4 `03-n2sf/` — N2SF 보안 (8개 문서)

**목적**: 국가 망 보안체계(N2SF) C/S/O 등급 분류 및 6개 보안 영역 통제 가이드

| 파일명 | 문서 ID | 목적 | 감리/CSAP 제출 |
|--------|---------|------|:------------:|
| `data-grade-classification.md` | N2SF-GRADE-001 | C/S/O 3등급 분류 기준, AI API 전송 판단 가이드 | ○ N2SF 증거 |
| `csap-n2sf-mapping.md` | N2SF-MAPPING | CSAP 79항목 x N2SF 6영역 전수 매핑 테이블 | ○ 핵심 증거 |
| `n2sf-infrastructure-architecture.md` | N2SF-INFRA | 6영역 x k3s 인프라 전체 아키텍처 설계서 | ○ 설계 증거 |
| `n2sf-change-monitoring.md` | N2SF-MONITOR | N2SF 규정 변경 모니터링 절차 | 참조 자료 |
| `domains/N01-management-security.md` | N2SF-N01 | N01 관리보안 통제 가이드 | N2SF 증거 |
| `domains/N02-authentication.md` | N2SF-N02 | N02 인증·권한 통제 가이드 | N2SF 증거 |
| `domains/N03-isolation.md` | N2SF-N03 | N03 분리·격리 통제 가이드 | N2SF 증거 |
| `domains/N04-encryption.md` | N2SF-N04 | N04 통제·암호화 가이드 | N2SF 증거 |
| `domains/N05-data.md` | N2SF-N05 | N05 데이터 보호 가이드, AI 연동 규칙 | ○ 핵심 증거 |
| `domains/N06-operations.md` | N2SF-N06 | N06 정보자산 운영 가이드 | N2SF 증거 |

**N2SF 활용 방법**:
- `data-grade-classification.md`: 서비스 데이터를 C/S/O로 분류할 때 기준 문서로 활용
- `csap-n2sf-mapping.md`: CSAP 심사 시 N2SF 준수 여부를 교차 증명하는 핵심 문서
- `domains/N05-data.md`: AI API 연동 시 데이터 등급 확인의 법적 근거 문서

**비즈니스 서비스 개발 후 수정 필요 사항**:
- `data-grade-classification.md`: 실제 서비스 데이터 유형별 등급 분류표 추가 — **개발 착수 전 필수**
- `n2sf-infrastructure-architecture.md`: 실제 k3s 클러스터 구성 반영 — **인프라 구축 후 필수**

---

### 2.5 `04-isms-p/` — ISMS-P (10개 문서)

**목적**: 2027년 7월 의무화 예정인 ISMS-P 101항목 준비 및 증적 자동화

| 파일명 | 문서 ID | 목적 | ISMS-P 제출 |
|--------|---------|------|:-----------:|
| `certification-guide.md` | ISMS-CERT | 2027 의무화 타임라인, CSAP→ISMS-P 전환 전략 | 경영진 보고 자료 |
| `evidence-automation-guide.md` | ISMS-AUTO | 감사 로그, 설정 변경, 교육 이력 자동 수집 방법 | ○ 핵심 문서 |
| `management-controls/M01-M04-policy-org.md` | ISMS-M01~04 | 관리체계 수립·운영 (정책, 조직, 범위) | ○ 제출 |
| `management-controls/M05-M08-risk.md` | ISMS-M05~08 | 위험 관리 (식별, 평가, 처리 계획) | ○ 제출 |
| `management-controls/M09-M12-operation.md` | ISMS-M09~12 | 운영 (자원 관리, 문서 관리) | ○ 제출 |
| `management-controls/M13-M16-improvement.md` | ISMS-M13~16 | 개선 (내부 감사, 경영 검토, 지속적 개선) | ○ 제출 |
| `protection-controls/P01-P14-access.md` | ISMS-P01~14 | 보호대책 — 접근 통제 (14개 항목) | ○ 제출 |
| `protection-controls/P15-P29-crypto.md` | ISMS-P15~29 | 보호대책 — 암호화 (15개 항목) | ○ 제출 |
| `protection-controls/P30-P44-network.md` | ISMS-P30~44 | 보호대책 — 네트워크 보안 (15개 항목) | ○ 제출 |
| `protection-controls/P45-P64-operation.md` | ISMS-P45~64 | 보호대책 — 운영 보안 (20개 항목) | ○ 제출 |
| `privacy-controls/I01-I07-collection.md` | ISMS-I01~07 | 개인정보 처리 — 수집 (7개 항목) | ○ 제출 |
| `privacy-controls/I08-I14-processing.md` | ISMS-I08~14 | 개인정보 처리 — 처리 (7개 항목) | ○ 제출 |
| `privacy-controls/I15-I21-disposal.md` | ISMS-I15~21 | 개인정보 처리 — 파기 (7개 항목) | ○ 제출 |

**ISMS-P 활용 방법**:
1. `certification-guide.md`로 2027 의무화 타임라인 확인
2. CSAP 인증 후 → `M01~M16`, `P01~P64`, `I01~I21` 자가진단
3. `evidence-automation-guide.md`로 자동 증적 수집 시스템 구축
4. 2026년 하반기 예비 심사 신청

**비즈니스 서비스 개발 후 수정 필요 사항**:
- 모든 M/P/I 파일: 실제 서비스 개인정보 처리 내역 기입 — **개인정보 처리 시 필수**

---

### 2.6 `05-audit-docs/` — 감리 T01~T02 원본 (2개 문서)

> **주의**: 이 디렉토리의 파일은 참조용입니다. **실제 감리 제출**은 `06-audit-compliance/templates/` 파일을 사용하십시오.

| 파일명 | 목적 |
|--------|------|
| `T01-business-plan.md` | 사업계획서 참조 원본 |
| `T02-requirements.md` | 요구사항정의서 참조 원본 |

---

### 2.7 `06-audit-compliance/` — 감리 산출물 T01~T07 (8개 문서)

**목적**: 행안부 고시 제2023-1호에 따른 7개 필수 감리 산출물 템플릿

#### 감리 산출물 목록

| 파일명 | 산출물 | 감리 근거 | 제출 단계 | 완성도 |
|--------|--------|---------|---------|--------|
| `templates/T01-business-plan.md` | 사업계획서 | §5 | 예비 감리 | 템플릿 (입력 필요) |
| `templates/T02-requirements.md` | 요구사항정의서 | §6 | 예비/1차 감리 | 템플릿 (입력 필요) |
| `templates/T03-detailed-design.md` | 상세설계서 | §7 | 1차 감리 | 템플릿 (입력 필요) |
| `templates/T04-traceability-matrix.md` | 추적성 매트릭스 | §8 | 1차/최종 감리 | 프레임워크 항목 완비 |
| `templates/T05-test-plan.md` | 시험계획서 | §7 | 2차 감리 | 79항목 계획 완비 |
| `templates/T06-test-result.md` | 시험결과서 | §7 | 최종 감리 | 템플릿 (결과 입력 필요) |
| `templates/T07-defect-management.md` | 결함관리대장 | §8 | 전 단계 | 템플릿 (결함 입력 필요) |
| `audit-completion-checklist.md` | 감리 완료 체크리스트 | §10 | 최종 감리 | 체크 완비 |

**감리 산출물 활용 순서**:
```
1. T01 사업계획서 작성 ({중괄호} 채워 넣기)
2. T02 요구사항정의서 (FR/NFR/INFR 목록 작성)
3. T03 상세설계서 (ER/API/보안 설계 추가)
4. T04 추적성 매트릭스 (FR ↔ 산출물 ↔ 테스트 ↔ CSAP 연결)
5. T05 시험계획서 (시험 일정·담당자 확정)
6. T06 시험결과서 (실제 시험 실행 후 결과 기입)
7. T07 결함관리대장 (발견 결함 실시간 등록·관리)
```

**비즈니스 서비스 개발 후 수정 필요 사항**:
- T01: 사업명, 기관명, 일정, 예산 전체 — **예비 감리 전 필수**
- T02: 비즈니스 FR 항목 추가 (FR-20.x 이상) — **1차 감리 전 필수**
- T03: 실제 ER 다이어그램, API 명세, 보안 설계 — **1차 감리 전 필수**
- T06: 실제 시험 결과 수치 기입 — **최종 감리 전 필수**
- T07: 발생한 실제 결함 등록 — **상시 관리 필수**

---

### 2.8 `07-infra/` — 인프라 (20개 문서)

**목적**: k3s(WSL2) 기반 공공 SaaS 인프라 구성 및 CSAP 보안 설정 가이드

| 파일명 | 목적 | CSAP 연계 |
|--------|------|---------|
| `k3s-wsl2/cluster-setup-recipe.md` | k3s 클러스터 10분 구성 레시피 | D-11 가상화 보안 |
| `k3s-wsl2/scripts/install-k3s.sh` | 설치 자동화 스크립트 | D-11 |
| `gitea-cicd-guide.md` | Gitea + Gitea Actions CI/CD 파이프라인 | D-12 개발 보안 |
| `gitea-actions-templates/build-test.yml` | 빌드·테스트 자동화 템플릿 | D-12 |
| `gitea-actions-templates/security-scan.yml` | 보안 스캔 자동화 (Trivy) | D-12, D-05 |
| `gitea-actions-templates/deploy-k3s.yml` | k3s 배포 자동화 | D-12 |
| `flux-gitops-guide.md` | Flux v2 GitOps 설정 가이드 | D-05 공급망 |
| `flux-gitops/kustomization-templates/git-repository.yaml` | Flux GitRepository 템플릿 | D-05 |
| `harbor-registry-guide.md` | Harbor 컨테이너 레지스트리 설정 | D-05, D-11 |
| `network-policy-guide.md` | k3s NetworkPolicy C/S/O 격리 가이드 | D-10 네트워크 |
| `network-policies/grade-c-isolation.yaml` | C등급 완전 격리 NetworkPolicy | D-10 |
| `network-policies/grade-s-restricted.yaml` | S등급 제한 통신 NetworkPolicy | D-10 |
| `network-policies/grade-o-ai-gateway.yaml` | O등급 AI GW 허용 NetworkPolicy | D-10 |
| `opentelemetry-guide.md` | OpenTelemetry 통합 관측 가이드 | D-06 침해사고 |
| `container-security-baseline.md` | 컨테이너 보안 기준선 설정 | D-11 |
| `policy-as-code/README.md` | Policy-as-Code 개요 | D-11, D-12 |
| `policy-as-code/kyverno-policies.md` | Kyverno 정책 자동화 | D-11 |
| `policy-as-code/opa-gatekeeper.md` | OPA Gatekeeper 정책 가이드 | D-11 |
| `supply-chain/sbom-guide.md` | SBOM(소프트웨어 자재명세서) 생성 가이드 | D-05-02 |
| `supply-chain/sigstore-signing.md` | Cosign 이미지 서명 검증 가이드 | D-05-03 |

**CSAP 심사 활용**:
- `network-policies/*.yaml`: D-10 네트워크 보안 **설정 증거로 직접 제출**
- `gitea-actions-templates/security-scan.yml`: D-12 SAST/DAST **자동화 증거**
- `supply-chain/sbom-guide.md`: D-05-02 SBOM **구현 증거**
- `container-security-baseline.md`: D-11 가상화 보안 **기준 문서**

---

### 2.9 `08-ai-integration/` — AI 연동 보안 (5개 문서)

**목적**: N2SF 데이터 등급에 따른 AI API 접근 제어 및 LM Studio 온프레미스 운영

| 파일명 | 목적 | N2SF/CSAP 연계 |
|--------|------|:------------:|
| `security-gateway-pattern.md` | AI 보안 게이트웨이 아키텍처, C/S등급 차단 패턴 | N2SF N-05, CSAP-D13 |
| `data-classification-masking.md` | PII 마스킹 구현 패턴 (이름/전화/주민번호) | N2SF N-05 |
| `lmstudio-guide.md` | LM Studio 온프레미스 AI 서버 구성 | N2SF C/S등급 처리 |
| `lmstudio-client-examples.md` | LM Studio API 연동 TypeScript 예제 | 개발 참조 |
| `mcp-integration-guide.md` | MCP(Model Context Protocol) 보안 연동 | CSAP-D12 |

**CSAP D-13 공공기관 추가 보호조치 활용**:
- `security-gateway-pattern.md`: AI API 연동 시 N2SF 데이터 등급 통제 증거
- `data-classification-masking.md`: PII 처리 마스킹 구현 증거

**비즈니스 서비스 개발 후 수정 필요 사항**:
- `security-gateway-pattern.md`: 실제 서비스 AI 연동 API 목록 반영 — **AI 기능 개발 시 필수**
- `data-classification-masking.md`: 실제 처리하는 개인정보 유형 추가 — **개인정보 처리 시 필수**

---

### 2.10 `09-cc-harness/` — CC 하네스 검증 (1개 문서)

| 파일명 | 목적 |
|--------|------|
| `harness-verification-guide.md` | Claude Code 하네스 구성 검증 절차, 5개 에이전트 + Q-Gate 확인 방법 |

**CSAP 활용**: CSAP D-12 "시스템 개발 보안" 자동화 도구 운영 증거로 활용 가능

---

### 2.11 `10-multitenancy/` — 멀티테넌시 (3개 문서) {#10-multitenancy}

| 파일명 | 목적 |
|--------|------|
| `architecture-guide.md` | N2SF 등급별 테넌트 격리 아키텍처 |
| `tenant-isolation-policy.md` | 테넌트 격리 정책, Kyverno 기반 네임스페이스 격리 |
| `onboarding-procedure.md` | 공공기관 테넌트 온보딩 자동화 절차 |

**CSAP D-11/D-10 활용**: 가상화 보안 및 네트워크 격리 증거 문서

**비즈니스 서비스 개발 후 수정 필요 사항**:
- 실제 테넌트(고객 공공기관) 목록 반영 — **서비스 출시 전 필수**

---

### 2.12 `11-documentation-portal/` — 문서 포털 (2개 문서)

| 파일명 | 목적 |
|--------|------|
| `docusaurus-setup-guide.md` | Docusaurus 설치 및 역할별 사이드바 구성 |
| `content-organization.md` | 문서 포털 콘텐츠 구성 원칙 |

---

### 2.13 `12-compliance-dashboard/` — 준수 현황 대시보드 (2개 문서)

| 파일명 | 목적 |
|--------|------|
| `dashboard-architecture.md` | CSAP/N2SF/ISMS-P 통합 대시보드 아키텍처 |
| `grafana-dashboard-spec.md` | Grafana 패널 상세 스펙 (79개 통제항목 실시간 현황) |

**CSAP 활용**: 실시간 준수 현황을 CSAP 심사관에게 시연할 때 활용

---

### 2.14 `14-framework-upgrade/` — 버전 관리 (2개 문서)

| 파일명 | 목적 |
|--------|------|
| `upgrade-procedure.md` | 프레임워크 버전 업그레이드 30일 SLA 절차 |
| `version-management-guide.md` | 시맨틱 버저닝, 롤백 절차 |

---

### 2.15 `99-references/` — 참조 (4개 문서)

| 파일명 | 문서 ID | 목적 | 감리/CSAP 활용 |
|--------|---------|------|:------------:|
| `regulations-index.md` | REF-INDEX | 외부 규정 14건 URL + 적용 영역 | ○ 법적 근거 문서 |
| `glossary-and-acronyms.md` | REF-GLOSSARY | 용어 35개 + 약어 37개 정의 | 감리 보조 자료 |
| `oscal/csap-profile.json` | OSCAL-CSAP | CSAP 79항목 기계가독형 OSCAL 프로파일 | ○ OSCAL 제출 |
| `oscal/oscal-mapping-guide.md` | OSCAL-GUIDE | OSCAL CLI 검증 방법 | 자동화 도구 |

**CSAP 심사 활용**:
- `regulations-index.md`: 모든 보안 요건의 **법적 근거 원문 출처** 제시 시 활용
- `oscal/csap-profile.json`: OSCAL 기반 자동화 심사 지원 시 제출

---

## 3. 감리(행안부) 단계별 활용 가이드

### 3.1 감리 단계 개요

행안부 정보시스템 감리기준 고시 제2023-1호에 따른 감리 단계:

```
[예비 감리] → [1차 감리] → [2차 감리] → [최종 감리]
착수·기획      분석·설계    구현·테스트    종료·완료
```

### 3.2 예비 감리 (착수·기획 단계)

**제출 필요 산출물**:

| 산출물 | 파일 경로 | 완성 필요 사항 |
|--------|---------|------------|
| T01 사업계획서 | `06-audit-compliance/templates/T01-business-plan.md` | {중괄호} 전체 채우기 |
| T02 요구사항정의서 (초안) | `06-audit-compliance/templates/T02-requirements.md` | FR/NFR 초안 작성 |

**체크리스트**:
- [ ] T01: 사업명·기관명·기간·목적 기입 완료
- [ ] T01: 추진 일정(WBS) 구체적 날짜 기입 완료
- [ ] T01: 예산 계획 금액 기입 완료
- [ ] T01: 이해관계자 연락처 기입 완료
- [ ] T02: FR-1.x ~ FR-10.x 전수 검토 완료
- [ ] T02: 비즈니스 서비스 전용 FR 추가 완료

### 3.3 1차 감리 (분석·설계 단계)

**제출 필요 산출물**:

| 산출물 | 파일 경로 | 완성 필요 사항 |
|--------|---------|------------|
| T02 요구사항정의서 (확정) | `templates/T02-requirements.md` | NFR 수용 기준 수치 확정 |
| T03 상세설계서 | `templates/T03-detailed-design.md` | ER 다이어그램, API 명세 완성 |
| T04 추적성 매트릭스 | `templates/T04-traceability-matrix.md` | FR ↔ CSAP 매핑 완성 |

**체크리스트**:
- [ ] T03: 실제 ER 다이어그램 삽입 완료
- [ ] T03: 실제 API 엔드포인트 전수 기재
- [ ] T03: 보안 설계 (RBAC, 암호화, 감사 로그) 기재
- [ ] T04: FR ID와 산출물 파일 경로 1:1 매핑 완료

### 3.4 2차 감리 (구현·테스트 단계)

**제출 필요 산출물**:

| 산출물 | 파일 경로 | 완성 필요 사항 |
|--------|---------|------------|
| T05 시험계획서 | `templates/T05-test-plan.md` | 시험 일정·담당자 확정 |
| T06 시험결과서 (중간) | `templates/T06-test-result.md` | 진행된 시험 결과 기입 |
| T07 결함관리대장 | `templates/T07-defect-management.md` | 발견 결함 전수 등록 |

### 3.5 최종 감리 (종료·완료 단계)

**제출 필요 산출물**: T01~T07 전체 최종본

**핵심 확인 사항** (`06-audit-compliance/audit-completion-checklist.md` 참조):
- [ ] CL-01: T01~T07 전수 완비
- [ ] CL-02: FR 추적성 100% (T04 매트릭스 완결)
- [ ] CL-03: CSAP 해당 Phase 100%
- [ ] CL-04: 테스트 커버리지 80% 이상
- [ ] CL-05: T07 CRITICAL/HIGH 결함 미결 0건
- [ ] CL-06: 감사 로그 완비 (`.claude/audit.jsonl`)
- [ ] CL-07: OWASP Top 10 통과

---

## 4. CSAP 인증 단계별 활용 가이드

### 4.1 CSAP 일반등급 취득 절차 (소요 기간: 약 1개월)

```
1단계: 자가진단 (3일)
  → 02-csap/simple-grade/checklist-simple.md
  → 30개 항목 전수 체크

2단계: 미충족 항목 보완 (1~2주)
  → 각 항목 "증거 자료" 목록대로 준비

3단계: KISA 심사 신청
  → checklist-simple.md 완성본 + 증거 파일 패키지 제출

4단계: 현장 심사 대응
  → 심사관 인터뷰 → 설정 화면 시연
```

**핵심 활용 문서**:
- `02-csap/simple-grade/checklist-simple.md` (자가진단)
- `02-csap/simple-grade/quick-start-guide.md` (등급 비교)
- `03-n2sf/data-grade-classification.md` (데이터 분류)

### 4.2 CSAP 표준등급 취득 절차 (소요 기간: 약 3~6개월)

```
1단계: 마스터 체크리스트 자가진단 (5일)
  → 02-csap/standard-grade/checklist-master.md
  → 79항목 전수 체크, 미충족 항목 목록 작성

2단계: D01~D13 구현 가이드 순서대로 준비
  → 각 D0X.md의 "증거 자료" 목록 대로 파일 수집

3단계: 감리 산출물 T01~T04 완성
  → 06-audit-compliance/templates/ 전체

4단계: 시험 실행 + T05~T07 완성
  → T05 계획 → 실제 시험 실행 → T06 결과 기입 → T07 결함 관리

5단계: KISA 심사 신청
  → 마스터 체크리스트 + 증거 파일 + T01~T07 패키지 제출

6단계: 현장 심사 대응
  → 담당자별 준비 (정책 담당, 기술 담당, 운영 담당)
```

**CSAP 분야별 핵심 문서**:

| CSAP 분야 | 핵심 문서 | 추가 증거 파일 |
|---------|---------|------------|
| D-01 정보보호 정책 | `D01-policy.md` | 정보보호 정책서(별도 작성 필요) |
| D-02 조직 보안 | `D02-org-security.md` | 조직도, CISO 임명장 |
| D-03 인적 보안 | `D03-personnel.md` | 보안 서약서, 교육 이력 |
| D-04 자산 관리 | `D04-asset-mgmt.md` | IT 자산 대장 |
| D-05 공급망 | `D05-supply-chain.md` + `supply-chain/sbom-guide.md` | SBOM 파일 |
| D-06 침해사고 | `D06-incident.md` + `opentelemetry-guide.md` | 감사 로그 샘플 |
| D-07 재해복구 | `D07-disaster-recovery.md` | BCP 문서(별도 작성 필요) |
| D-08 접근 통제 | `D08-access-control.md` | RBAC 설정 화면 |
| D-09 암호화 | `D09-encryption.md` | TLS 인증서, 키 관리 절차 |
| D-10 네트워크 | `D10-network-security.md` + `network-policies/*.yaml` | 방화벽 설정 |
| D-11 가상화 | `D11-virtualization-security.md` + `container-security-baseline.md` | kube-bench 결과 |
| D-12 개발 보안 | `D12-system-dev-security.md` + `coding-style-guide.md` | SAST 결과 |
| D-13 공공기관 추가 | `D13-public-agency-additional.md` + `security-gateway-pattern.md` | 운영 절차서 |

### 4.3 CSAP 취득 후 사후 관리

- **연 1회 사후 심사**: 변경된 항목을 `checklist-master.md`에 재점검
- **규정 변경 모니터링**: `99-references/regulations-index.md` 분기 1회 URL 유효성 확인
- **증적 자동화**: `07-isms-p/auto-evidence-collection.md` 및 `04-isms-p/evidence-automation-guide.md`

---

## 5. N2SF 준수 활용 가이드

### 5.1 N2SF 준수 3단계 절차

```
1단계: 데이터 등급 분류
  → 03-n2sf/data-grade-classification.md
  → 실제 서비스 데이터를 C/S/O로 분류

2단계: 6개 영역별 통제 구현
  → 03-n2sf/domains/N01~N06.md 순서대로
  → 인프라 보안: 07-infra/network-policy-guide.md

3단계: CSAP-N2SF 교차 증명
  → 03-n2sf/csap-n2sf-mapping.md
  → CSAP 심사 시 N2SF 준수 매핑으로 중복 증명
```

---

## 6. ISMS-P 2027 의무화 준비 가이드

### 6.1 CSAP → ISMS-P 전환 전략

```
CSAP 취득 완료
    ↓
중복 항목 40개 자동 대응
    ↓
추가 61개 항목 준비
  → 04-isms-p/management-controls/ (관리체계 16항목)
  → 04-isms-p/protection-controls/ (보호대책 64항목)
  → 04-isms-p/privacy-controls/ (개인정보보호 21항목)
    ↓
2026.09 예비 심사 신청
```

**핵심 참조**: `04-isms-p/certification-guide.md` (2026~2027 월별 타임라인)

---

## 7. 비즈니스 서비스 개발 시 수정 필수 목록

> 현재 프레임워크 문서는 **제출 가능한 템플릿**으로 구성되어 있습니다.
> 실제 비즈니스 서비스가 개발되면 아래 문서를 반드시 수정하십시오.

### 7.1 개발 착수 전 (필수)

| 우선순위 | 파일 경로 | 수정 내용 |
|---------|---------|---------|
| 🔴 P0 | `06-audit-compliance/templates/T01-business-plan.md` | 사업명, 기관명, 사업 기간, 예산 전체 기입 |
| 🔴 P0 | `06-audit-compliance/templates/T02-requirements.md` | 비즈니스 FR 항목 추가 (FR-20.x 이상) |
| 🔴 P0 | `03-n2sf/data-grade-classification.md` | 실제 처리 데이터 유형별 C/S/O 등급 기입 |
| 🔴 P0 | `02-csap/standard-grade/checklist-master.md` | 현재 준수 상태 체크 (☐ → ☑) |

### 7.2 인프라 구축 후 (필수)

| 우선순위 | 파일 경로 | 수정 내용 |
|---------|---------|---------|
| 🔴 P0 | `06-audit-compliance/templates/T03-detailed-design.md` | 실제 ER, API, 보안 설계 삽입 |
| 🟡 P1 | `03-n2sf/n2sf-infrastructure-architecture.md` | 실제 k3s 클러스터 구성 반영 |
| 🟡 P1 | `07-infra/network-policies/` YAML 파일들 | 실제 서비스 네임스페이스 반영 |

### 7.3 AI 기능 개발 시 (필수)

| 우선순위 | 파일 경로 | 수정 내용 |
|---------|---------|---------|
| 🔴 P0 | `08-ai-integration/security-gateway-pattern.md` | 실제 AI API 목록 및 라우팅 규칙 반영 |
| 🔴 P0 | `08-ai-integration/data-classification-masking.md` | 실제 PII 필드 마스킹 목록 반영 |

### 7.4 시험·감리 전 (필수)

| 우선순위 | 파일 경로 | 수정 내용 |
|---------|---------|---------|
| 🔴 P0 | `06-audit-compliance/templates/T06-test-result.md` | 실제 시험 결과 수치 기입 |
| 🔴 P0 | `06-audit-compliance/templates/T07-defect-management.md` | 발견 결함 전수 등록 |
| 🔴 P0 | `06-audit-compliance/audit-completion-checklist.md` | CL-01~CL-07 전수 체크 |

### 7.5 개인정보 처리 서비스 (해당 시 필수)

| 우선순위 | 파일 경로 | 수정 내용 |
|---------|---------|---------|
| 🔴 P0 | `04-isms-p/privacy-controls/I01-I07-collection.md` | 실제 개인정보 수집 항목 기재 |
| 🔴 P0 | `04-isms-p/privacy-controls/I08-I14-processing.md` | 실제 처리 방법 기재 |
| 🔴 P0 | `04-isms-p/privacy-controls/I15-I21-disposal.md` | 실제 파기 절차 기재 |

---

## 8. 문서 품질 기준 (감리/CSAP 제출 기준)

| 품질 지표 | 기준 | 확인 방법 |
|---------|------|---------|
| FR 추적성 | FR ID 전수 매핑 (T04) | T04 추적성 매트릭스 완결 여부 |
| 증거 자료 완비 | 각 CSAP 항목별 증거 파일 존재 | D0X.md 증거 목록 대조 |
| 템플릿 완성도 | {중괄호}/[TODO] 항목 0건 | 텍스트 검색으로 확인 |
| 변경 이력 | 모든 문서에 버전·일자·내용 기록 | 각 문서 하단 확인 |
| 한국어 표기 | 공공기관 표준 용어 사용 | 용어 사전 대조 |
| 감리관 확인란 | 감리관 서명·날짜 완비 | T01~T07 확인란 |

---

## 9. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 100개 문서 전수 안내, 감리/CSAP/N2SF/ISMS-P 활용 가이드 통합, 비즈니스 서비스 수정 목록 | Claude Code (PM Lead) |
