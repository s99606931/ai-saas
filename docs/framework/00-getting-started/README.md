# 공공기관 SaaS 프레임워크

| 항목 | 내용 |
|------|------|
| 문서 ID | FW-README |
| 버전 | 0.1.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | 공공 SaaS 신규 진출 기업 전 직군 |
| FR 매핑 | FR-0.1, FR-0.2 |

<!-- Design Ref: MTU-F1-getting-started.design.md 2.1절 -- 진입점 설계 -->

---

## 1. 프레임워크 소개

본 프레임워크는 **공공기관 SaaS** 사업자가 다음 3가지 인증·감리를 체계적으로 준비하기 위한 문서·코드·절차 통합 가이드입니다.

| 인증/감리 | 발행 기관 | 핵심 내용 | 프레임워크 지원 범위 |
|---------|---------|---------|----------------|
| **CSAP** (클라우드 보안 인증) | KISA | 일반/표준/중요 3등급, 최대 79개 통제항목 | 일반등급 30항목 + 표준등급 79항목 전수 |
| **N2SF** (국가 네트워크 보안 체계) | 국정원/KISA | C/S/O 3등급 데이터 분류, 6개 보안 영역 | 등급별 매핑 + AI 연동 데이터 통제 |
| **행안부 감리** | 행안부 | 고시 제2023-1호, 착수~종료 7단계 산출물 | T01~T07 감리 산출물 템플릿 |

**기술 스택**: k3s (경량 Kubernetes) + WSL2 + Gitea (자체 호스팅 CI/CD) + Claude Code (AI 하네스)

---

## 2. 프레임워크 구조

```
docs/framework/
├── 00-getting-started/      ← 지금 여기 (시작하기)
├── 01-dev-standards/        ← 개발 표준 가이드
├── 02-csap/                 ← CSAP (일반등급 + 표준등급)
│   ├── simple-grade/        ←   일반등급 빠른 시작
│   └── standard-grade/      ←   표준등급 79항목 + D01~D13 구현 가이드
├── 03-n2sf/                 ← N2SF 등급 분류·영역별 통제
├── 04-isms-p/               ← ISMS-P 체크리스트·증적 자동화
├── 05-audit-docs/           ← 감리 산출물 T01~T02
├── 06-audit-compliance/     ← 감리 T03~T07·감리 체크리스트
├── 07-infra/                ← 인프라 (k3s/Gitea/Flux/네트워크/OTel)
├── 08-ai-integration/       ← AI 보안 게이트웨이·LM Studio
├── 09-cc-harness/           ← CC 하네스 검증 절차서
├── 10-oscal/                ← OSCAL 호환성 레이어
├── 11-documentation-portal/ ← Docusaurus 문서 포털
├── 12-compliance-dashboard/ ← 준수 현황 대시보드
├── 13-multitenancy/         ← 멀티테넌시 SaaS 아키텍처
├── 14-framework-upgrade/    ← 프레임워크 버전 관리
└── 99-references/           ← 규정 인덱스 + 용어 사전
```

### 모듈 상세

| 디렉토리 | 모듈명 | 설명 | Phase | MTU | 상태 |
|---------|--------|------|-------|-----|------|
| `00-getting-started/` | 시작하기 | 진입점, 역할별 경로, 사전 요건 | 1 | MTU-F1 | 완료 |
| `01-dev-standards/` | 개발 표준 | 문서 유형 템플릿, ID 체계, 코딩 가이드, 리뷰 체크리스트 | 1 | MTU-F3 | 완료 |
| `02-csap/` | CSAP | 일반등급 30항목 + 표준등급 79항목 + D01~D13 구현 가이드 | 1~2 | MTU-F4, C1~C3 | 완료 |
| `03-n2sf/` | N2SF | 등급 분류, CSAP 매핑, 6개 영역 통제, 아키텍처 | 2~3 | MTU-C4~C5, I5 | 완료 |
| `04-isms-p/` | ISMS-P | 101항목 체크리스트, 증적 자동화, 자가진단 | 3 | MTU-C6a~C6b | 진행 중 |
| `05-audit-docs/` | 감리 T01~T02 | 사업계획서, 요구사항정의서 템플릿 | 1 | MTU-F5 | 완료 |
| `06-audit-compliance/` | 감리 T03~T07 | 설계서, 테스트, 추적성, 감리 체크리스트 | 3~4 | MTU-A3a~A3c | 진행 중 |
| `07-infra/` | 인프라 | k3s, Gitea CI/CD, Flux, Harbor, OTel, Policy as Code | 2~3 | MTU-I1~I4, C7~C8 | 완료 |
| `08-ai-integration/` | AI 연동 | AI 보안 게이트웨이, MCP, LM Studio 가이드 | 4 | MTU-A1~A2 | 진행 중 |
| `09-cc-harness/` | CC 하네스 | 하네스 구성 검증 절차서 | 1 | MTU-F6 | 완료 |
| `10-oscal/` | OSCAL | CSAP+N2SF 기계가독형 매핑, oscal-cli 검증 | 4 | MTU-A4 | 진행 중 |
| `11-documentation-portal/` | 문서 포털 | Docusaurus 역할별 사이드바, MDX 인터랙티브 뷰어 | 4 | MTU-A5 | 진행 중 |
| `12-compliance-dashboard/` | 준수 대시보드 | CSAP+N2SF+ISMS-P 실시간 Grafana 대시보드 | 4 | MTU-A6 | 미착수 |
| `13-multitenancy/` | 멀티테넌시 | N2SF 등급별 격리, Kyverno 정책, 온보딩 자동화 | 5 | MTU-E2 | 미착수 |
| `14-framework-upgrade/` | 버전 관리 | 시맨틱 버저닝, 30일 SLA, 롤백 절차 | 5 | MTU-E3 | 미착수 |
| `99-references/` | 참조 | 외부 규정 인덱스 14건, 용어 35개, 약어 37개 | 1 | MTU-F2 | 완료 |

---

## 3. 역할별 진입점

프레임워크에서 본인 역할에 맞는 첫 문서를 선택하세요.

| 역할 | 목표 | 첫 번째 파일 | 소요 시간 |
|------|------|-----------|---------|
| **CTO/팀장** | 프레임워크 전체 파악 + 인증 로드맵 | 본 README.md -> [quick-start.md](quick-start.md) 경로 A | 15분 |
| **PM/기획자** | CSAP 인증 준비 시작 | [quick-start.md](quick-start.md) 경로 B -> `02-csap/simple-grade/` | 15분 |
| **개발자/DevOps** | 개발 환경 구성 | [quick-start.md](quick-start.md) 경로 C -> `01-dev-standards/` | 15분 |
| **감리 담당** | 산출물 준비 | `05-audit-docs/T01-business-plan.md` | 20분 |
| **보안 담당** | CSAP/N2SF 확인 | `02-csap/simple-grade/checklist-simple.md` | 15분 |

> 어디서 시작할지 모르겠다면 [quick-start.md](quick-start.md)를 읽으세요.

---

## 4. Phase 로드맵

전체 프레임워크는 5개 Phase로 구성됩니다.

| Phase | 명칭 | MTU 수 | 핵심 산출물 | 상태 |
|-------|------|--------|-----------|------|
| **Phase 1** | Foundation | 6 | Getting Started, 개발 표준, CSAP 일반등급, 감리 T01~T02, 참조, 하네스 검증 | 진행 중 |
| Phase 2 | Infrastructure + CSAP | 11 | k3s 클러스터, Gitea CI/CD, CSAP 표준등급 79항목, N2SF 매핑 | 미착수 |
| Phase 3 | Audit + AI | 7 | 감리 T03~T07, AI 게이트웨이, LM Studio 가이드 | 미착수 |
| Phase 4 | Advanced Compliance | 6 | OSCAL 매핑, Docusaurus 포털, 컴플라이언스 대시보드 | 미착수 |
| Phase 5 | Enterprise | 5 | ISMS-P 2027, 멀티테넌시, Policy-as-Code, 공급망 보안 | 미착수 |

**전체 35개 MTU** (Minimum Testable Unit)로 구성. 각 MTU는 독립 PDCA 사이클로 관리됩니다.

---

## 5. CC 하네스 (Claude Code 하네스)

본 프레임워크는 **ECC(Everything Claude Code) v1.9.0** 기반 하네스를 사용합니다.

**하네스 핵심 요소**:

| 요소 | 설명 |
|------|------|
| `CLAUDE.md` | 프로젝트 절대 제약, 7단계 Q-Gate 정의, 모델 라우팅 |
| 5개 에이전트 | Implementer(Sonnet), Reviewer(Sonnet), Auditor(Opus), Tester(Sonnet), Refactorer(Haiku) |
| 7단계 Q-Gate | G1(FR ID) -> G2(설계 완전성) -> G3(코드 품질) -> G4(테스트 80%+) -> G5(OWASP) -> G6(CSAP) -> G7(감사 추적) |
| strict 훅 프로필 | `--no-verify` 차단, `--force` 차단, 위험 명령 차단 |
| 감사 로그 | `.claude/audit.jsonl` 전수 기록 (CSAP D-06 준수) |

하네스 검증 절차: `09-cc-harness/harness-verification-guide.md` 참조

---

## 6. 시작하기

### 처음이라면

1. [prerequisites.md](prerequisites.md)에서 사전 요건을 확인하세요
2. [quick-start.md](quick-start.md)에서 본인 역할에 맞는 15분 경로를 따라가세요

### 참조 문서

| 문서 | 위치 | 용도 |
|------|------|------|
| 외부 규정 인덱스 | `99-references/regulations-index.md` | CSAP/N2SF/감리 관련 법령 참조 |
| 용어·약어 사전 | `99-references/glossary-and-acronyms.md` | 공공 SaaS 전문 용어 확인 |
| 하네스 검증 | `09-cc-harness/harness-verification-guide.md` | CC 하네스 구성 검증 |

---

## 7. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 프레임워크 구조 8+1 모듈, 5개 역할 진입점, Phase 1~5 로드맵 | Claude Code (PM Lead) |
