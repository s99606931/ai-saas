# 공공기관 SaaS 프레임워크 문서 체계

| 항목 | 내용 |
|------|------|
| 문서 ID | FW-ROOT-README |
| 버전 | 1.1.0 |
| 최종 수정일 | 2026-04-08 |
| 대상 | 공공 SaaS 사업자 전 직군 — CTO, PM, 개발자, 보안 담당자, 감리 담당자 |
| 목적 | 프레임워크 전체 문서 체계 안내 및 역할별 진입점 제공 |
| 문서 위치 | `docs/framework/README.md` |

---

## 프레임워크란?

본 문서 체계는 **공공기관에 SaaS 서비스를 제공하는 사업자**가 다음 세 가지 인증·감리를 체계적으로 준비하고 통과할 수 있도록 설계된 **통합 가이드**입니다.

| 인증·감리 | 발행 기관 | 핵심 내용 |
|---------|---------|---------|
| **CSAP** (클라우드 보안 인증) | KISA | 일반/표준/중요 3등급, 최대 79개 통제항목 |
| **N2SF** (국가 망 보안 체계) | 국가정보원/KISA | C/S/O 데이터 등급 분류, 6개 보안 영역 통제 |
| **행안부 감리** | 행정안전부 | 고시 제2023-1호, T01~T07 7단계 산출물 |
| **ISMS-P** (2027 의무화) | KISA | 101개 항목, 2027년 7월 시행 |

**기술 스택**: k3s + WSL2 + Gitea CI/CD + Flux GitOps + Harbor + OpenTelemetry + Claude Code 하네스

---

## 디렉토리 구조

```
docs/framework/
│
├── README.md                    ← 지금 여기 (전체 안내)
│
├── 00-getting-started/          ← 처음 시작 시 필독
│   ├── README.md                   역할별 진입점·Phase 로드맵
│   ├── quick-start.md              역할별 15분 경로 (CTO/PM/개발자)
│   ├── prerequisites.md            기술 사전 요건 체크리스트
│   ├── FRAMEWORK-GUIDE.md          전체 문서 목적·활용법 종합 안내
│   └── AUDIT-CSAP-SUBMISSION-GUIDE.md  감리·CSAP 인증 제출 절차
│
├── 01-dev-standards/            ← 개발 표준
│   ├── coding-style-guide.md       코딩 스타일·보안 패턴 (CSAP D-12)
│   ├── doc-type-templates.md       문서 유형별 표준 템플릿
│   ├── requirement-id-system.md    FR/NFR/INFR ID 체계
│   └── review-checklist.md         코드·문서 리뷰 체크리스트
│
├── 02-csap/                     ← CSAP 인증 핵심
│   ├── simple-grade/
│   │   ├── checklist-simple.md     일반등급 30항목 자가진단
│   │   └── quick-start-guide.md    3등급 비교·빠른 시작
│   └── standard-grade/
│       ├── checklist-master.md     표준등급 79항목 마스터 체크리스트
│       └── implementation-guide/
│           ├── D01-policy.md       ~ D13-public-agency-additional.md
│           └── (D01~D13 구현 가이드 13개)
│
├── 03-isms-p/                   ← ISMS-P 2027 의무화 대비
│   ├── certification-guide.md         2027 취득 타임라인·전략
│   ├── dual-certification-procedure.md CSAP+ISMS-P 이중 인증 절차
│   ├── evidence-automation-guide.md   증적 자동화 설정
│   ├── auto-evidence-collection.md    일간/월간 증적 수집 파이프라인
│   ├── checklist-101.md               101항목 자가진단
│   ├── evidence-pipeline.md           증적 파이프라인 설계
│   ├── management-controls/           관리체계 M01~M16
│   ├── protection-controls/           보호대책 P01~P64
│   ├── privacy-controls/              개인정보보호 I01~I21
│   ├── certification-prep/            인증 준비 자료
│   ├── integrated-evidence/           통합 증적 매핑
│   └── renewal/                       갱신 절차
│
├── 04-n2sf/                     ← N2SF 보안 체계
│   ├── data-grade-classification.md   C/S/O 등급 분류·AI API 판단
│   ├── csap-n2sf-mapping.md           79항목 × 6영역 매핑 테이블
│   ├── n2sf-infrastructure-architecture.md  인프라 아키텍처
│   ├── n2sf-change-monitoring.md      규정 변경 모니터링 절차
│   └── domains/
│       └── N01~N06.md (6개 보안 영역 통제 가이드)
│
├── 05-audit-docs/               ← 감리 T01~T02 (참조본)
│   ├── T01-business-plan.md
│   └── T02-requirements.md
│
├── 06-ecosystem/                ← 에코시스템 (배포·플러그인·운영)
│   ├── deployment-checklist.md        배포 전 체크리스트
│   ├── plugin-development-guide.md    플러그인 개발 가이드
│   └── troubleshooting-faq.md         운영 FAQ
│
├── 07-audit-compliance/         ← 감리 T01~T07 (제출용 완성 템플릿)
│   ├── audit-completion-checklist.md  감리 완료 체크리스트
│   └── templates/
│       ├── T01-business-plan.md       사업계획서
│       ├── T02-requirements.md        요구사항정의서
│       ├── T03-detailed-design.md     상세설계서
│       ├── T04-traceability-matrix.md 추적성 매트릭스 (4방향)
│       ├── T05-test-plan.md           시험계획서
│       ├── T06-test-result.md         시험결과서
│       └── T07-defect-management.md   결함관리대장
│
├── 08-infra/                    ← 인프라·DevSecOps
│   ├── k3s-wsl2/                    k3s 클러스터 구성
│   ├── gitea-cicd-guide.md          Gitea CI/CD 파이프라인
│   ├── gitea-actions-templates/     빌드·보안스캔·배포 워크플로우
│   ├── flux-gitops-guide.md         Flux v2 GitOps
│   ├── harbor-registry-guide.md     Harbor 컨테이너 레지스트리
│   ├── network-policy-guide.md      C/S/O 등급별 네트워크 격리
│   ├── network-policies/            등급별 NetworkPolicy YAML
│   ├── opentelemetry-guide.md       통합 관측 가능성
│   ├── container-security-baseline.md  컨테이너 보안 기준선
│   ├── policy-as-code/              Kyverno·OPA Gatekeeper
│   └── supply-chain/                SBOM·Cosign 서명 검증
│
├── 09-ai-integration/           ← AI 보안 연동
│   ├── security-gateway-pattern.md   AI 보안 게이트웨이 (C/S등급 차단)
│   ├── data-classification-masking.md PII 마스킹 구현
│   ├── lmstudio-guide.md             LM Studio 온프레미스 서버
│   ├── lmstudio-client-examples.md   TypeScript 연동 예제
│   └── mcp-integration-guide.md      MCP 보안 연동
│
├── 10-cc-harness/               ← Claude Code 하네스
│   └── harness-verification-guide.md  5개 에이전트·Q-Gate 검증 절차
│
├── 11-multitenancy/             ← 멀티테넌시 SaaS
│   ├── architecture-guide.md        N2SF 등급별 테넌트 격리 아키텍처
│   ├── tenant-isolation-policy.md   격리 정책·Kyverno 설정
│   └── onboarding-procedure.md      공공기관 테넌트 온보딩 자동화
│
├── 12-documentation-portal/    ← 문서 포털 (Docusaurus)
│   ├── docusaurus-setup-guide.md    설치·역할별 사이드바 구성
│   └── content-organization.md      콘텐츠 구성 원칙
│
├── 13-compliance-dashboard/    ← 준수 현황 대시보드
│   ├── dashboard-architecture.md    CSAP/N2SF/ISMS-P 통합 아키텍처
│   └── grafana-dashboard-spec.md    Grafana 패널 상세 스펙
│
├── 14-framework-upgrade/       ← 프레임워크 버전 관리
│   ├── upgrade-procedure.md         30일 SLA 업그레이드 절차
│   └── version-management-guide.md  시맨틱 버저닝·롤백
│
└── 99-references/              ← 참조
    ├── regulations-index.md         외부 규정 인덱스 14건
    ├── glossary-and-acronyms.md     용어 35개·약어 37개
    └── oscal/
        ├── csap-profile.json        CSAP 79항목 OSCAL 프로파일
        └── oscal-mapping-guide.md   OSCAL CLI 검증 방법
```

---

## 역할별 첫 번째 문서

| 역할 | 목표 | 첫 번째 문서 |
|------|------|-----------|
| **CTO / 팀장** | 전체 구조·인증 로드맵 파악 | [`00-getting-started/README.md`](00-getting-started/README.md) |
| **PM / 기획자** | CSAP 자가진단 시작 | [`02-csap/simple-grade/checklist-simple.md`](02-csap/simple-grade/checklist-simple.md) |
| **보안 담당자** | CSAP 표준등급 준비 | [`02-csap/standard-grade/checklist-master.md`](02-csap/standard-grade/checklist-master.md) |
| **개발자 / DevOps** | 개발 표준·인프라 구성 | [`01-dev-standards/coding-style-guide.md`](01-dev-standards/coding-style-guide.md) |
| **감리 담당자** | 감리 산출물 T01~T07 준비 | [`07-audit-compliance/templates/T01-business-plan.md`](07-audit-compliance/templates/T01-business-plan.md) |
| **처음 접하는 경우** | 역할에 맞는 15분 경로 | [`00-getting-started/quick-start.md`](00-getting-started/quick-start.md) |

---

## 감리·CSAP 인증 핵심 경로

### 행안부 감리 제출 순서

```
T01 사업계획서  →  T02 요구사항정의서  →  T03 상세설계서
       ↓                   ↓                    ↓
  예비 감리 제출        1차 감리 제출          1차 감리 제출
                                                 ↓
                              T04 추적성 매트릭스 (4방향)
                                                 ↓
                  T05 시험계획서  →  T06 시험결과서  →  T07 결함관리대장
                        ↓                  ↓                  ↓
                    2차 감리 제출      최종 감리 제출      상시 관리
```

**모든 감리 산출물 위치**: [`07-audit-compliance/templates/`](07-audit-compliance/templates/)

### CSAP 표준등급 자가진단 순서

```
1. 79항목 자가진단    →  2. 미충족 항목 보완    →  3. 증거 자료 수집
   checklist-master.md      D01~D13 구현 가이드       각 Dxx.md 증거 목록
        ↓
4. KISA 심사 신청  →  5. 현장 심사 대응  →  6. 사후 관리 (연 1회)
```

**자세한 제출 절차**: [`00-getting-started/AUDIT-CSAP-SUBMISSION-GUIDE.md`](00-getting-started/AUDIT-CSAP-SUBMISSION-GUIDE.md)

---

## 인증별 핵심 문서 요약

### CSAP 인증

| 단계 | 문서 |
|------|------|
| 일반등급 자가진단 | `02-csap/simple-grade/checklist-simple.md` |
| 표준등급 마스터 체크리스트 | `02-csap/standard-grade/checklist-master.md` |
| D01~D13 구현 가이드 | `02-csap/standard-grade/implementation-guide/D01~D13.md` |
| 감리 산출물 T01~T07 | `07-audit-compliance/templates/T01~T07.md` |

### N2SF 준수

| 단계 | 문서 |
|------|------|
| 데이터 C/S/O 등급 분류 | `04-n2sf/data-grade-classification.md` |
| CSAP-N2SF 매핑 | `04-n2sf/csap-n2sf-mapping.md` |
| 6개 영역 통제 가이드 | `04-n2sf/domains/N01~N06.md` |
| AI API 보안 게이트웨이 | `09-ai-integration/security-gateway-pattern.md` |

### ISMS-P 2027 의무화 대비

| 단계 | 문서 |
|------|------|
| 취득 타임라인 | `03-isms-p/certification-guide.md` |
| CSAP+ISMS-P 이중 인증 절차 | `03-isms-p/dual-certification-procedure.md` |
| 관리체계 16항목 | `03-isms-p/management-controls/M01~M16.md` |
| 보호대책 64항목 | `03-isms-p/protection-controls/P01~P64.md` |
| 개인정보보호 21항목 | `03-isms-p/privacy-controls/I01~I21.md` |
| 증적 자동화 | `03-isms-p/auto-evidence-collection.md` |

---

## 문서 완성도 현황

| 디렉토리 | 문서 수 | 상태 | 비고 |
|---------|--------|------|------|
| `00-getting-started/` | 5 | 완료 | 신규 가이드 2개 포함 |
| `01-dev-standards/` | 4 | 완료 | |
| `02-csap/` | 16 | 완료 | 79항목 전수 수록 |
| `03-isms-p/` | 14 | 진행 중 | 구 04-isms-p 병합 완료 |
| `04-n2sf/` | 9 | 완료 | 6개 영역 전수 수록 |
| `05-audit-docs/` | 2 | 완료 | 참조본 |
| `06-ecosystem/` | 3 | 완료 | 배포·플러그인·운영 FAQ |
| `07-audit-compliance/` | 8 | 진행 중 | 템플릿 완비, 실제 내용 입력 필요 |
| `08-infra/` | 20 | 완료 | |
| `09-ai-integration/` | 5 | 완료 | |
| `10-cc-harness/` | 1 | 완료 | |
| `11-multitenancy/` | 3 | 진행 중 | |
| `12-documentation-portal/` | 2 | 진행 중 | |
| `13-compliance-dashboard/` | 2 | 미착수 | |
| `14-framework-upgrade/` | 2 | 진행 중 | |
| `99-references/` | 4 | 완료 | OSCAL 포함 |
| **합계** | **100** | — | — |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 프레임워크 루트 README, 전체 디렉토리 트리, 역할별 진입점, 인증별 핵심 문서 요약 | Claude Code |
| 1.1.0 | 2026-04-08 | 폴더 번호 중복 해소 — 03-isms-p+04-isms-p 병합, 03-n2sf→04-n2sf 이동, 05-ecosystem→06-ecosystem 이동, 06~12 시프트, 디렉토리 트리·완성도 표 최신화 | Claude Code |
