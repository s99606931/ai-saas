# Archive Index — 2026-04

> 이 폴더는 2026년 4월에 완료된 PDCA 사이클 문서를 보관합니다.

| Feature | 완료일 | 매치율 | 아카이브 경로 |
|---------|------|--------|------------|
| av-skill | 2026-04-05 | 93.6% | `docs/archive/2026-04/av-skill/` |
| **MTU-F2** 참조 기반 레이어 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F2-references/` |
| **MTU-F6** CC 하네스 완성도 검증 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F6-harness-verify/` |
| **MTU-F1** Getting Started 레이어 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F1-getting-started/` |
| **MTU-F4** CSAP 간편등급 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F4-csap-simple/` |
| **MTU-F5** 감리 T01~T02 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F5-audit-t01-t02/` |
| **MTU-F3** 개발 표준 가이드 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F3-dev-standards/` |
| **MTU-C1** CSAP 표준등급 마스터 체크리스트 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-C1-csap-master-checklist/` |
| **MTU-I1** k3s WSL2 클러스터 + 보안 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-I1-k3s-wsl2/` |
| **MTU-C2a** CSAP D01~D04 구현 가이드 | 2026-04-05 | 98.3% | `docs/archive/2026-04/MTU-C2a-csap-d01-d04/` |
| **MTU-C2b** CSAP D05~D07 구현 가이드 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-C2b-csap-d05-d07/` |
| **MTU-C3** CSAP D08~D13 구현 가이드 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-C3-csap-d08-d13/` |
| **MTU-C4** N2SF 등급 분류 + CSAP 매핑 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-C4-n2sf-mapping/` |
| **MTU-C5** N2SF 6개 영역 통제 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-C5-n2sf-domains/` |
| **MTU-C7** Policy as Code | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-C7-policy-as-code/` |
| **MTU-I2** Gitea CI/CD 파이프라인 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-I2-gitea-cicd/` |

## av-skill 요약

- **설명**: Auto-Vibe Plugin Advisor — 자연어 요구사항을 6-의도로 분류하고 bkit/ECC 200개+ 구성요소 자동 선택·실행
- **PDCA 사이클**: PM → Plan → Design → Do (2 sessions) → Check → Report
- **최종 매치율**: 93.6%
- **산출물**: `~/.claude/skills/av/` (SKILL.md + 3개 참조 파일, 36KB)
- **문서**:
  - `av-skill.plan.md` — Plan 문서
  - `av-skill.design.md` — Design 문서 (Option C 아키텍처)
  - `av-skill.report.md` — 완료 보고서

## MTU-F2 참조 기반 레이어 요약

- **설명**: CSAP/N2SF/ISMS-P 외부 규정 인덱스 + 용어·약어 사전
- **PDCA 사이클**: Plan → Design → Do → Check (100%) → Report → Archive
- **최종 매치율**: 100% (6/6 수용 기준 전수 통과)
- **산출물**: `docs/framework/99-references/` (regulations-index.md, glossary-and-acronyms.md)
- **주요 성과**: 2026년 최신 규정 14건, 용어 35개, 약어 37개, 32개 MTU 역참조 매트릭스
- **문서**:
  - `MTU-F2-references.plan.md` — Plan 문서
  - `MTU-F2-references.design.md` — Design 문서
  - `MTU-F2.report.md` — 완료 보고서

## MTU-F6 CC 하네스 완성도 검증 요약

- **설명**: ECC 하네스 5개 에이전트 + Q-Gate G1~G7 검증 절차
- **최종 매치율**: 100% (7/7 수용 기준 통과)
- **산출물**: `docs/framework/07-cc-harness/harness-verification-guide.md`
- **문서**: Plan + Design + Report

## MTU-F1 Getting Started 레이어 요약

- **설명**: 프레임워크 진입점 — README, 빠른 시작, 사전 준비 가이드
- **최종 매치율**: 100% (5/5 수용 기준 통과)
- **산출물**: `docs/framework/00-getting-started/` (README.md, quick-start.md, prerequisites.md)
- **문서**: Plan + Design + Report

## MTU-F4 CSAP 간편등급 요약

- **설명**: CSAP 일반등급 빠른 시작 가이드 + 간편 체크리스트
- **최종 매치율**: 100% (6/6 수용 기준 통과)
- **산출물**: `docs/framework/02-csap/simple-grade/` (quick-start-guide.md, checklist-simple.md)
- **문서**: Plan + Design + Report

## MTU-F5 감리 T01~T02 요약

- **설명**: 행안부 감리기준 T01(사업계획서) + T02(요구사항정의서) 템플릿
- **최종 매치율**: 100% (6/6 수용 기준 통과)
- **산출물**: `docs/framework/03-audit-docs/` (T01-business-plan.md, T02-requirements.md)
- **문서**: Plan + Design + Report

## MTU-F3 개발 표준 가이드 요약

- **설명**: 문서 유형 템플릿, 요구사항 ID 체계, 코딩 스타일, 코드리뷰 체크리스트
- **최종 매치율**: 100% (6/6 수용 기준 통과)
- **산출물**: `docs/framework/01-dev-standards/` (4개 파일)
- **문서**: Plan + Design + Report

## MTU-C1 CSAP 표준등급 마스터 체크리스트 요약

- **설명**: CSAP 표준등급 13개 분야 79개 통제항목 전수 마스터 체크리스트 (OSCAL 호환 ID)
- **PDCA 사이클**: Plan (기존) -> Design -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100% (7/7 수용 기준 통과)
- **산출물**: `docs/framework/02-csap/standard-grade/checklist-master.md` (79항목, 7필드, 13분야)
- **주요 성과**: CSAP-DXX-YY ID 79개 전수, HTML 앵커 79개, OSCAL 매핑 테이블, 추적성 매트릭스
- **후속 영향**: MTU-C2a, C2b, C3, C4, C6a 착수 가능
- **문서**: Plan + Design + Analysis + Report

## MTU-C2b CSAP D05~D07 구현 가이드 요약

- **설명**: CSAP 표준등급 D05~D07 (공급망/침해사고/재해복구) 구현 가이드
- **PDCA 사이클**: Plan (기존) -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100% (5/5 시험 시나리오 통과)
- **산출물**: `docs/framework/02-csap/standard-grade/implementation-guide/` (D05, D06, D07 3개 파일)
- **포함 항목**: D05(4) + D06(5) + D07(3) = 12개 통제항목 전수
- **주요 성과**: SBOM 관리 4단계 (MTU-C8 연계), 침해사고 대응 5단계 + audit.jsonl, RTO 4시간/RPO 1시간 + k3s etcd 백업 스크립트
- **문서**: Plan + Report

## MTU-C3 CSAP D08~D13 구현 가이드 요약

- **설명**: CSAP 표준등급 D08~D13 (접근통제/암호화/네트워크/가상화/개발보안/공공기관추가) 구현 가이드
- **PDCA 사이클**: Plan (기존) -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100% (4/4 시험 시나리오 통과)
- **산출물**: `docs/framework/02-csap/standard-grade/implementation-guide/` (D08~D13 6개 파일)
- **포함 항목**: D08(12) + D09(4) + D10(8) + D11(7) + D12(10) + D13(10) = 51개 통제항목 전수
- **주요 성과**: RBAC+JWT+MFA 패턴, AES-256-GCM+TLS 1.3 코드, k3s PSS restricted+Trivy+Falco, Kyverno Policy as Code, OWASP Top 10 매핑
- **후속 영향**: MTU-C7/C8 연계 링크 완비
- **문서**: Plan + Report

## MTU-C4 N2SF 등급 분류 + CSAP 매핑 요약

- **설명**: CSAP 79항목 x N2SF 6영역 전수 매핑 + C/S/O 데이터 등급 분류 체계
- **PDCA 사이클**: Plan (기존) -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100% (2/2 시험 시나리오 통과)
- **산출물**: `docs/framework/03-n2sf/` (csap-n2sf-mapping.md, data-grade-classification.md)
- **포함 항목**: 79항목 전수 매핑, C/S/O 3등급 체계, AI API 판단 흐름도, TypeScript DataGrade 패턴
- **주요 성과**: CSAP-N2SF 이중 규제 동시 충족 증거, maskPII 함수, classifyData 헬퍼
- **후속 영향**: MTU-C5, MTU-A1, MTU-A2 연계
- **문서**: Plan + Report

## MTU-C2a CSAP D01~D04 구현 가이드 요약

- **설명**: CSAP 표준등급 D01~D04 관리적 통제 분야 (정책/조직/인적/자산) 구현 가이드
- **PDCA 사이클**: Plan -> Design -> Do -> Check (98.3%) -> Report -> Archive
- **최종 매치율**: 98.3% (16/16항목 전수, 5/5 시험 시나리오 통과)
- **산출물**: `docs/framework/02-csap/standard-grade/implementation-guide/` (D01~D04 4개 파일)
- **포함 템플릿**: 정보보호 정책서, 보안 서약서, 교육 이력, 자산 대장, 폐기 확인서 등 11종
- **후속 영향**: MTU-C2b, C3, C6a 연결
- **문서**: Plan + Design + Analysis + Report

## MTU-I1 k3s WSL2 클러스터 + 보안 요약

- **설명**: WSL2에서 CSAP-D11 보안 설정이 적용된 k3s 클러스터 10분 이내 구성 레시피
- **PDCA 사이클**: Plan -> Design -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100% (5/5 합격 기준 통과, 27/27 검증 항목 충족)
- **산출물**: `docs/framework/05-infra/` (cluster-setup-recipe.md, install-k3s.sh, container-security-baseline.md)
- **주요 성과**: kube-router CNI + PSS restricted + deny-all NetworkPolicy 표준 조합, CSAP-D11 7항목 x CIS Benchmark 매핑
- **후속 영향**: MTU-I2, I3, I4, C7 착수 가능
- **문서**: Plan + Design + Analysis + Report

## MTU-C5 N2SF 6개 영역 통제 구현 가이드 요약

- **설명**: N2SF 6개 보안 영역(N01~N06) 전수 통제 구현 가이드 — 격리·접근·암호화·데이터·운영 보안 구현 패턴
- **PDCA 사이클**: Plan (기존) -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100%
- **산출물**: `docs/framework/03-n2sf/domains/` (N01~N06 6개 파일)
- **포함 항목**: N01(네트워크 격리) + N02(ID 및 접근) + N03(격리 아키텍처) + N04(암호화) + N05(데이터) + N06(운영) 전수
- **주요 성과**: N2SF 6개 영역 구현 코드 패턴, CSAP 역참조 테이블, 증적 자료 체크리스트
- **후속 영향**: MTU-A1(AI 연동), MTU-A2(보안 게이트웨이) 연계
- **아카이브 경로**: `docs/archive/2026-04/MTU-C5-n2sf-domains/`
- **문서**: Plan + Report

## MTU-C7 Policy as Code 요약

- **설명**: Kyverno + OPA(Open Policy Agent) 기반 Policy as Code 구현 가이드 — k3s 환경 자동화 정책 적용
- **PDCA 사이클**: Plan (기존) -> Do -> Check (100%) -> Report -> Archive
- **최종 매치율**: 100%
- **산출물**: `docs/framework/05-infra/policy-as-code/` (Kyverno 정책 + OPA Rego 정책 파일)
- **포함 항목**: PSS restricted 정책, 이미지 서명 검증, NetworkPolicy 자동 적용, RBAC 감사 정책
- **주요 성과**: CSAP-D08/D11/D12 통제항목 코드 자동화, CI/CD 파이프라인 정책 게이트 연동
- **후속 영향**: MTU-I2(Gitea CI/CD) 정책 게이트 연계, MTU-C3 준수 자동화
- **아카이브 경로**: `docs/archive/2026-04/MTU-C7-policy-as-code/`
- **문서**: Plan + Report

---

> IDX-GAP-1/IDX-GAP-2 수정 (2026-04-05): MTU-C5, MTU-C7 요약 섹션 추가 | Implementer Agent
