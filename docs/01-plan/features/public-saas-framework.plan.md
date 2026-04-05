# 공공기관 SaaS 프레임워크 Plan 문서

| 항목 | 내용 |
|------|------|
| Feature ID | public-saas-framework |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Agent Team + Claude Code |
| 관련 PRD | docs/00-pm/public-saas-framework.prd.md |
| 감리 기준 | 행정안전부 정보시스템 감리기준 (고시 제2023-1호) |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 중소 IT 기업이 공공기관 SaaS 시장 진입 시 CSAP 인증·감리·N2SF 등 규제 장벽으로 6~12개월·수억 원 소요 |
| **솔루션** | CSAP 79항목 커버 템플릿·감리 산출물·k3s 인프라 레시피·AI 연동 아키텍처를 표준 프레임워크로 제공 |
| **기능/UX 효과** | 비즈니스 도메인 결정 즉시 프레임워크 위에서 개발 착수 가능, 감리 체크리스트 자동 매핑 |
| **핵심 가치** | 공공기관 SaaS 시장 민주화 — 대기업 전용이었던 공공 시장을 중소기업도 체계적 진입 가능 |

**구현 규모 지표**

| 항목 | 수량 |
|------|------|
| 총 기능 요구사항 (FR) | 35개 (FR-1.1 ~ FR-7.5) |
| 총 비기능 요구사항 | 21개 (NFR-8 + INFR-7 + AI-REQ-6) |
| CC 하네스 요구사항 | 10개 (CC-REQ-1 ~ CC-REQ-10) |
| CSAP 통제항목 커버리지 | 79개 (13개 분야 100%) |
| N2SF 보안 영역 | 6개 영역 × C/S/O 3등급 |
| 감리 산출물 | 7종 (T01~T06 + 추적성 매트릭스) |
| 최종 산출물 파일 수 | 54개 (7개 디렉토리) |
| 구현 기간 | 12개월 (4 Phase) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 공공기관 SaaS 진입 장벽(CSAP, 감리)을 표준화된 프레임워크로 제거 — 대기업 독점 시장 민주화 |
| **WHO** | Beachhead: 공공 SaaS 첫 진출 중소 IT 기업 CTO/PM/개발자 (10~50인, 연 5억~50억 매출) |
| **RISK** | N2SF 2026년 시행 기준 변경 위험 (High), CSAP 상등급 항목 수 미확정 (Medium) |
| **SUCCESS** | CSAP 79항목 100% 커버, k3s 10분 이내 구성, 감리 1차 통과율 90%+ |
| **SCOPE** | 프레임워크 문서·템플릿·가이드·레시피 (비즈니스 로직 구현 제외) |

---

## 1. Overview

### 1.1 목적 및 배경

본 문서는 공공기관 SaaS 서비스 개발을 위한 표준 프레임워크의 요구사항과 구현 계획을 정의합니다.
비즈니스 서비스 도메인은 아직 미정이며, 도메인 결정 즉시 이 프레임워크 위에서 개발·운영을
시작할 수 있도록 기준·템플릿·가이드·AI 서비스 연동 방법을 선제적으로 구축합니다.

**개발 환경**: WSL2 로컬 PC 전용 (외부 클라우드 서비스 없음, AI LLM 제외)

### 1.2 관련 문서

| 문서 | 위치 | 설명 |
|------|------|------|
| PRD | `docs/00-pm/public-saas-framework.prd.md` | 제품 요구사항 문서 (ECC Appendix 포함) |
| CC 오케스트레이션 PRD | `docs/01-plan/features/cc-orchestration-prd.md` | Claude Code 하네스 엔지니어링 PRD |
| 행안부 감리기준 | 고시 제2023-1호 | 정보시스템 감리기준 |
| CSAP 고시 | KISA 2023년 개정 | 클라우드서비스 보안인증 기준 |
| N2SF 가이드라인 | 국가정보원 | 국가 망 보안체계 |
| ECC 저장소 | https://github.com/affaan-m/everything-claude-code | CC 하네스 기반 |

### 1.3 용어 정의

| 용어 | 정의 |
|------|------|
| CSAP | 클라우드서비스 보안인증제 (Cloud Security Assurance Program) |
| N2SF | 국가 망 보안체계 (National Network Security Framework) |
| 감리 | 정보시스템 감리 (행정안전부 고시 기준) |
| k3s | 경량 Kubernetes 배포판 (WSL2 최적화) |
| ECC | Everything Claude Code (CC 하네스 엔지니어링 프레임워크) |
| 하네스 | AI 에이전트 주변 제약·자동화·관찰 인프라 |
| FR | 기능 요구사항 (Functional Requirement) |
| NFR | 비기능 요구사항 (Non-Functional Requirement) |
| INFR | 인프라 요구사항 (Infrastructure Requirement) |
| AI-REQ | AI 연동 요구사항 |
| CC-REQ | Claude Code 하네스 요구사항 |

---

## 2. Scope

### 2.1 포함 범위 (In Scope)

- Module 1: 개발 표준 가이드라인 (코딩 표준, 아키텍처 패턴, 보안 코딩)
- Module 2: CSAP 인증 지원 (간편등급 31항목, 표준등급 79항목, 상등급 추가)
- Module 3: N2SF 보안체계 (C/S/O 등급 분류, 6개 보안 영역, CSAP↔N2SF 매핑)
- Module 4: 감리 대응 (7종 산출물 템플릿, 추적성 매트릭스, 감리 체크리스트)
- Module 5: 기술 인프라 (k3s on WSL2, Gitea + Gitea Actions CI/CD)
- Module 6: AI 서비스 연동 (Claude API 등 외부 LLM, 보안 게이트웨이, 데이터 마스킹)
- Module 7: 운영 가이드 (배포·장애·백업·변경관리 절차서)
- Claude Code 하네스 구성 (ECC 기반 5개 전문 에이전트, Hooks, CLAUDE.md)

### 2.2 제외 범위 (Out of Scope)

- 특정 비즈니스 서비스 도메인 구현 (미정)
- 실제 CSAP 인증 심사 수행 (외부 기관)
- 외부 클라우드 인프라 운영 (로컬 WSL2 전용)
- AI/LLM 모델 커스터마이징·파인튜닝·로컬 훈련 (Out of Scope 유지)
- 마켓플레이스 실제 등록 (Phase 4, 별도 진행)

> **범위 변경 (v0.2.0, 2026-04-05)**: 온프레미스 LLM **설치 및 연동 가이드**는 In Scope로 변경.
> N2SF C/S등급 데이터를 AI로 처리하기 위한 필수 방안 (Llama 3.1 등 오픈웨이트 모델).
> 모델 자체 수정(파인튜닝, 커스터마이징)은 Out of Scope 유지.
> 근거: CTO 검토 R-02, 시장조사 반영 (하이브리드 LLM 전략)

### 2.3 전제 조건 및 제약사항

| 항목 | 내용 |
|------|------|
| 운영 환경 | WSL2 (Ubuntu 22.04 LTS) on Windows 11 |
| K8s 배포 | k3s v1.28+ (외부 클라우드 없음) |
| CI/CD | Gitea + Gitea Actions (완전 자립형) |
| AI/LLM (외부) | Claude API, GPT-4 등 외부 LLM — N2SF O등급 데이터 + PII 마스킹 후 사용 |
| AI/LLM (온프레미스) | **LM Studio** (Windows 호스트 실행, `host.docker.internal:1234`) — N2SF C/S등급 데이터 전용 |
| AI 데이터 제한 | N2SF C/S 등급 데이터 AI API 전송 금지 |
| 문서 언어 | 한국어 전용 (공공기관 표준 용어) |
| 구현 원칙 | Plan/Design 문서 완비 후에만 구현 착수 |
| CC 하네스 | ECC v1.9.0 기반 strict 프로필 적용 |

---

## 3. 프레임워크 디렉토리 구조

아래는 이 프레임워크가 완성되었을 때의 최종 산출물 파일 구조입니다.
각 파일은 정확히 하나의 FR에 대응합니다.

```
public-saas-framework/
│
├── 00-getting-started/                              # Phase 1 (M1)
│   ├── README.md                                    # 프레임워크 전체 개요
│   ├── quick-start.md                               # 15분 퀵스타트 가이드
│   └── prerequisites.md                             # 사전 요건 체크리스트
│
├── 01-dev-standards/                                # Module 1 (Phase 1, M1)
│   ├── coding-standards.md                          # FR-1.1: 보안 코딩 표준
│   ├── architecture-patterns.md                     # FR-1.2: 아키텍처 패턴 카탈로그
│   ├── code-review-checklist.md                     # FR-1.3: 코드 리뷰 체크리스트
│   └── secure-coding-guide.md                       # FR-1.4: 보안 코딩 실무 가이드
│
├── 02-csap/                                         # Module 2
│   ├── simple-grade/                                # Phase 1 (M1)
│   │   ├── checklist-simple.md                      # FR-2.2: 31개 항목 체크리스트
│   │   └── implementation-guide.md                  # FR-2.2a: 간편등급 구현 가이드
│   ├── standard-grade/                              # Phase 2 (M4~M5)
│   │   ├── checklist-master.md                      # FR-2.1: 79개 항목 체크리스트
│   │   ├── self-diagnosis.md                        # FR-2.4: 자가 진단 체크리스트
│   │   └── implementation-guide/                    # FR-2.3: 13개 분야 구현 가이드
│   │       ├── D01-policy.md                        # 정보보호 정책 (4항목)
│   │       ├── D02-org-security.md                  # 조직 보안 (3항목)
│   │       ├── D03-personnel.md                     # 인적 보안 (4항목)
│   │       ├── D04-asset-mgmt.md                    # 자산 관리 (5항목)
│   │       ├── D05-supply-chain.md                  # 서비스 공급망 관리 (4항목)
│   │       ├── D06-incident.md                      # 침해사고 관리 (5항목)
│   │       ├── D07-disaster-recovery.md             # 재해 복구 (3항목)
│   │       ├── D08-access-control.md                # 접근 통제 (12항목)
│   │       ├── D09-cryptography.md                  # 암호화 (4항목)
│   │       ├── D10-network-security.md              # 네트워크 보안 (8항목)
│   │       ├── D11-virtualization.md                # 가상화 보안 (7항목)
│   │       ├── D12-dev-security.md                  # 시스템 개발 보안 (10항목)
│   │       └── D13-public-additional.md             # 공공기관 추가 보호조치 (10항목)
│   ├── high-grade/                                  # Phase 3 (M8)
│   │   └── additional-requirements.md               # FR-2.5: 상등급 추가 요건
│   └── certification-procedure.md                   # FR-2.6: 인증 신청 절차
│
├── 03-n2sf/                                         # Module 3 (Phase 2, M6)
│   ├── grade-classification-guide.md                # FR-3.1: C/S/O 분류 가이드
│   ├── security-domains/                            # FR-3.2: 6개 영역별 통제
│   │   ├── N01-authority.md                         # 권한 영역
│   │   ├── N02-authentication.md                    # 인증 영역
│   │   ├── N03-isolation.md                         # 분리 및 격리 영역
│   │   ├── N04-control.md                           # 통제 영역
│   │   ├── N05-data.md                              # 데이터 영역
│   │   └── N06-assets.md                            # 정보자산 영역
│   ├── csap-to-n2sf-mapping.md                      # FR-3.3: CSAP↔N2SF 전환 매핑
│   └── reference-architecture/                      # FR-3.4: 등급별 레퍼런스 아키텍처
│       ├── grade-c-architecture.md
│       ├── grade-s-architecture.md
│       └── grade-o-architecture.md
│
├── 06-audit-compliance/                             # Module 4
│   ├── templates/                                   # Phase 1~2 (M2~M3)
│   │   ├── T01-business-plan.md                     # FR-4.1: 사업계획서
│   │   ├── T02-requirements.md                      # FR-4.2: 요구사항 정의서
│   │   ├── T03-design-basic.md                      # FR-4.3a: 기본 설계서
│   │   ├── T04-design-detail.md                     # FR-4.3b: 상세 설계서
│   │   ├── T05-test-plan.md                         # FR-4.4a: 시험계획서
│   │   └── T06-test-result.md                       # FR-4.4b: 시험결과서
│   ├── traceability-matrix.md                       # FR-4.5: 추적성 매트릭스 (Phase 3, M8)
│   ├── audit-checklist/                             # FR-4.6: 단계별 감리 체크리스트
│   │   ├── phase1-planning.md
│   │   ├── phase2-analysis.md
│   │   ├── phase3-design.md
│   │   ├── phase4-implementation.md
│   │   └── phase5-testing.md
│   └── defect-response-guide.md                     # FR-4.7: 감리 지적사항 대응 가이드
│
├── 07-infra/                                        # Module 5 (Phase 2, M6)
│   ├── k3s-wsl2/
│   │   ├── cluster-setup-recipe.md                  # FR-5.1: k3s 클러스터 구성 레시피
│   │   └── scripts/                                 # FR-5.1a: 자동화 쉘 스크립트
│   ├── gitea/
│   │   ├── setup-guide.md                           # FR-5.2: Gitea 설치 가이드
│   │   └── cicd-pipeline-templates/                 # FR-5.3: CI/CD 파이프라인 템플릿
│   │       ├── build.yml
│   │       ├── test.yml
│   │       └── deploy.yml
│   ├── container-security-baseline.md              # FR-5.4: 컨테이너 보안 베이스라인
│   ├── network-security.md                          # FR-5.5: 네트워크 보안 구성
│   └── monitoring-logging.md                        # FR-5.6: 모니터링·로깅 설정
│
├── 08-ai-integration/                              # Module 6 (Phase 3, M7)
│   ├── security-gateway-pattern.md                 # FR-6.1: AI API 보안 게이트웨이
│   ├── data-classification-masking.md              # FR-6.2: 데이터 분류 및 마스킹
│   ├── audit-logging.md                            # FR-6.3: AI 감사 로깅 체계
│   ├── claude-api-guide.md                         # FR-6.4: Claude API 연동 가이드
│   ├── gpt4-api-guide.md                           # FR-6.5: GPT-4 연동 가이드
│   └── fallback-patterns.md                        # FR-6.6: AI 장애 Fallback 패턴
│
├── 07-operations/                                  # Module 7 (Phase 3, M9)
│   ├── deployment-procedure.md                     # FR-7.1: 배포 절차서
│   ├── incident-response.md                        # FR-7.2: 장애 대응 절차서
│   ├── backup-recovery.md                          # FR-7.3: 백업·복구 절차서
│   ├── performance-management.md                   # FR-7.4: 성능 관리 가이드
│   └── change-management.md                        # FR-7.5: 변경 관리 절차서
│
└── 99-references/
    ├── regulatory-references.md                    # 관련 법령·고시 목록
    ├── glossary.md                                 # 공공기관 표준 용어집
    └── changelog.md                               # 프레임워크 변경 이력
```

**설계 원칙**:
- 각 파일은 정확히 하나의 FR에 1:1 대응 (추적성 보장)
- 디렉토리 번호 = Module 번호 (00~07)
- Phase 우선순위 반영: 00, 01, 02 디렉토리가 Phase 1 우선

---

## 4. 모듈별 기능 요구사항

### 4.1 Module 1: 개발 표준 가이드라인

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-1.1 | 보안 코딩 표준 | P0 | 1 | `01-dev-standards/coding-standards.md` | 공공 SaaS 개발자가 독립적으로 적용 가능한 수준 |
| FR-1.2 | 아키텍처 패턴 카탈로그 | P0 | 1 | `01-dev-standards/architecture-patterns.md` | API Gateway, 마이크로서비스, 데이터 격리 패턴 포함 |
| FR-1.3 | 코드 리뷰 체크리스트 | P1 | 1 | `01-dev-standards/code-review-checklist.md` | ECC AgentShield 102규칙과 연동 가능한 형식 |
| FR-1.4 | 보안 코딩 실무 가이드 | P0 | 1 | `01-dev-standards/secure-coding-guide.md` | CSAP D-08(접근통제) + D-09(암호화) 항목 커버 |

### 4.2 Module 2: CSAP 인증 지원

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-2.1 | 표준등급 79개 항목 체크리스트 | P0 | 2 | `02-csap/standard-grade/checklist-master.md` | 79개 항목 100% 커버, 각 항목에 구현 가이드 링크 |
| FR-2.2 | 간편등급 31개 항목 체크리스트 | P0 | 1 | `02-csap/simple-grade/checklist-simple.md` | KISA 2023년 개정 고시 기준 31개 항목 전수 |
| FR-2.3 | 13개 분야 구현 가이드 | P0 | 2 | `02-csap/standard-grade/implementation-guide/` | 기술 PM이 5일 이내 준수 수준 자가 진단 가능 |
| FR-2.4 | 자가 진단 체크리스트 | P1 | 2 | `02-csap/standard-grade/self-diagnosis.md` | 인증 신청 전 준비 수준 90% 이상 확인 가능 |
| FR-2.5 | 상등급 추가 요건 | P1 | 3 | `02-csap/high-grade/additional-requirements.md` | KISA 상등급 고시 기준 (Phase 3 시작 시 확정) |
| FR-2.6 | 인증 신청 절차 | P2 | 2 | `02-csap/certification-procedure.md` | 신청부터 심사 완료까지 단계별 가이드 |

### 4.3 Module 3: N2SF 보안체계

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-3.1 | C/S/O 등급 분류 가이드 | P0 | 1 | `03-n2sf/grade-classification-guide.md` | 의사결정 트리로 3개 상이한 서비스 유형 올바른 분류 |
| FR-3.2 | 6개 보안 영역 통제항목 | P0 | 2 | `03-n2sf/security-domains/` | 각 영역의 C/S/O 등급별 요건 차이 명시 |
| FR-3.3 | CSAP↔N2SF 전환 매핑 | P0 | 2 | `03-n2sf/csap-to-n2sf-mapping.md` | 79개 항목 전수 N2SF 매핑 (미매핑 0개) |
| FR-3.4 | 등급별 레퍼런스 아키텍처 | P1 | 3 | `03-n2sf/reference-architecture/` | C/S/O 각 등급에서 즉시 적용 가능한 아키텍처 |

### 4.4 Module 4: 감리 대응

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-4.1 | 사업계획서 템플릿 | P0 | 1 | `06-audit-compliance/templates/T01-business-plan.md` | 행안부 고시 감리기준 별표 형식 준수 |
| FR-4.2 | 요구사항 정의서 템플릿 | P0 | 1 | `06-audit-compliance/templates/T02-requirements.md` | FR/NFR ID 체계 포함, 추적성 매트릭스 연동 |
| FR-4.3 | 설계서 템플릿 (기본+상세) | P0 | 1 | `06-audit-compliance/templates/T03,T04-*.md` | 아키텍처·API 명세·DB 스키마 섹션 포함 |
| FR-4.4 | 시험 산출물 템플릿 | P0 | 1 | `06-audit-compliance/templates/T05,T06-*.md` | 시험 케이스·결과·결함 목록 형식 포함 |
| FR-4.5 | 추적성 매트릭스 | P0 | 3 | `06-audit-compliance/traceability-matrix.md` | FR↔설계↔시험 3방향 + FR↔CSAP 매핑 |
| FR-4.6 | 단계별 감리 체크리스트 | P1 | 2 | `06-audit-compliance/audit-checklist/` | 5개 단계(계획~시험) 전수 체크리스트 |
| FR-4.7 | 지적사항 대응 가이드 | P1 | 3 | `06-audit-compliance/defect-response-guide.md` | 유형별 지적사항 대응 절차 및 증빙 방법 |

### 4.5 Module 5: 기술 인프라

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-5.1 | k3s 클러스터 구성 레시피 | P0 | 2 | `07-infra/k3s-wsl2/cluster-setup-recipe.md` | WSL2 신규 환경에서 개발자가 10분 이내 재현 성공 |
| FR-5.2 | Gitea 설치 가이드 | P0 | 2 | `07-infra/gitea/setup-guide.md` | Gitea v1.20+ 단독 컨테이너 구동 성공 |
| FR-5.3 | CI/CD 파이프라인 템플릿 | P0 | 2 | `07-infra/gitea/cicd-pipeline-templates/` | 빌드·테스트·배포 워크플로우 즉시 적용 가능 |
| FR-5.4 | 컨테이너 보안 베이스라인 | P1 | 2 | `07-infra/container-security-baseline.md` | CSAP D-11(가상화 보안) 7개 항목 커버 |
| FR-5.5 | 네트워크 보안 구성 | P1 | 2 | `07-infra/network-security.md` | CSAP D-10(네트워크 보안) 8개 항목 커버 |
| FR-5.6 | 모니터링·로깅 설정 | P1 | 2 | `07-infra/monitoring-logging.md` | CSAP D-08(접근통제) 중 감사 로그 항목 커버 |

### 4.6 Module 6: AI 서비스 연동

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-6.1 | AI API 보안 게이트웨이 패턴 | P0 | 3 | `08-ai-integration/security-gateway-pattern.md` | 모든 AI API 호출이 게이트웨이 경유하는 구조 |
| FR-6.2 | 데이터 분류 및 마스킹 | P0 | 3 | `08-ai-integration/data-classification-masking.md` | C/S 등급 데이터 AI 전송 차단 테스트 통과 |
| FR-6.3 | AI 감사 로깅 체계 | P0 | 3 | `08-ai-integration/audit-logging.md` | 요청/응답 전수 로깅, 보존 기간 최소 1년 |
| FR-6.4 | Claude API 연동 가이드 | P1 | 3 | `08-ai-integration/claude-api-guide.md` | claude-sonnet-4-6 기준 연동 예제 포함 |
| FR-6.5 | GPT-4 연동 가이드 | P2 | 3 | `08-ai-integration/gpt4-api-guide.md` | FR-6.4와 동일한 게이트웨이 통과 구조 |
| FR-6.6 | AI 장애 Fallback 패턴 | P1 | 3 | `08-ai-integration/fallback-patterns.md` | AI 서비스 장애 시 수동 전환 절차 명시 |

### 4.7 Module 7: 운영 가이드

| ID | 요구사항명 | 우선순위 | Phase | 산출물 파일 | 수용 기준 |
|----|-----------|---------|-------|-----------|---------|
| FR-7.1 | 배포 절차서 | P1 | 3 | `07-operations/deployment-procedure.md` | k3s 환경 신규 서비스 배포 절차 완비 |
| FR-7.2 | 장애 대응 절차서 | P1 | 3 | `07-operations/incident-response.md` | CSAP D-06(침해사고 관리) 5개 항목 커버 |
| FR-7.3 | 백업·복구 절차서 | P1 | 3 | `07-operations/backup-recovery.md` | CSAP D-07(재해 복구) 3개 항목 커버 |
| FR-7.4 | 성능 관리 가이드 | P2 | 3 | `07-operations/performance-management.md` | 주요 지표 및 임계값 정의 |
| FR-7.5 | 변경 관리 절차서 | P1 | 3 | `07-operations/change-management.md` | 변경 요청·승인·이행·검증 절차 |

---

## 5. 비기능 요구사항

### 5.1 표준 비기능 요구사항 (NFR)

| ID | 영역 | 요구 내용 | 측정 기준 | 측정 시점 |
|----|------|---------|---------|---------|
| NFR-1 | 보안 | CSAP 중등급 79개 항목 100% 커버 | 항목별 산출물 매핑 수 0개 누락 | Phase 2 완료 |
| NFR-2 | 보안 | N2SF 6개 영역 × C/S/O 3등급 완전 매핑 | 18개 셀 모두 채워짐 | Phase 2 완료 |
| NFR-3 | 호환성 | WSL2 Ubuntu 22.04 LTS + k3s v1.28+ 정상 동작 | 클린 환경 설치 테스트 통과 | Phase 2 완료 |
| NFR-4 | 확장성 | 도메인 독립적 구조 (3개 이상 상이한 도메인 적용 가능) | 3개 상이한 도메인 Mock 적용 검증 | Phase 2 완료 |
| NFR-5 | 문서화 | 행안부 정보시스템 감리기준(고시 제2023-1호) 준수 | 감리 체크리스트 대비 90% 이상 항목 충족 | Phase 2 완료 |
| NFR-6 | 독립성 | 외부 클라우드 서비스 종속 없음 (AI LLM 제외) | 외부 인터넷 차단 후 Gitea/k3s 정상 동작 | Phase 2 완료 |
| NFR-7 | 유지보수성 | 규제 변경 시 30일 이내 업데이트 | 모듈 독립적 변경 가능 구조 검증 | Phase 3 완료 |
| NFR-8 | 접근성 | 한국어 전용, 공공기관 표준 용어 적용 | 전 문서 한국어, 용어집 기준 100% 준수 | Phase 1 완료 |

### 5.2 인프라 요구사항 (INFR)

| ID | 구분 | 요구 내용 | 검증 방법 |
|----|------|---------|---------|
| INFR-1 | k3s | WSL2 Ubuntu 22.04 LTS에서 동작 | 클린 환경 설치 테스트 |
| INFR-2 | k3s | 싱글노드 클러스터 10분 이내 구성 | 시간 측정 자동화 스크립트 |
| INFR-3 | k3s | CSAP 보안 요건 반영 기본 설정 포함 | D-11 가상화 보안 체크리스트 대비 검증 |
| INFR-4 | Gitea | v1.20+ 단독 컨테이너 구동 가능 | 컨테이너 이미지 단독 실행 성공 |
| INFR-5 | Gitea | Actions로 빌드·테스트·배포 자동화 | 샘플 워크플로우 3종 실행 성공 |
| INFR-6 | 네트워크 | 폐쇄망(Airgap) 환경 구성 지원 | 외부 인터넷 차단 후 동작 확인 |
| INFR-7 | 모니터링 | 접근 로그 수집 기능 포함 (CSAP D-08) | 로그 수집 및 조회 성공 |

### 5.3 AI 연동 요구사항 (AI-REQ)

| ID | 요건 영역 | 요구 내용 | N2SF 연관 영역 |
|----|---------|---------|-------------|
| AI-REQ-1 | 게이트웨이 | 모든 AI API 호출은 중앙 게이트웨이 경유 필수 | N-04 통제 |
| AI-REQ-2 | 데이터 분류 | N2SF C/S 등급 데이터는 AI API 전송 금지 | N-05 데이터 |
| AI-REQ-3 | 마스킹 | O등급이라도 PII는 마스킹 후 전송 | N-05 데이터 |
| AI-REQ-4 | 감사 로그 | 요청/응답 전수 로깅 (보존 최소 1년) | N-04 통제 |
| AI-REQ-5 | Fallback | AI 서비스 장애 시 수동 전환 경로 제공 | N-01 권한 |
| AI-REQ-6 | 모델 독립성 | Claude/GPT-4 외 추가 모델 확장 가능 구조 | — |

---

## 6. CSAP 통제항목 커버리지 계획

### 6.1 13개 분야 × 79항목 산출물 매핑

| 분야 ID | 보호조치 분야 | 항목 수 | Phase | 커버 산출물 |
|--------|-----------|--------|-------|-----------|
| D-01 | 정보보호 정책 | 4 | 2 | `02-csap/standard-grade/implementation-guide/D01-policy.md` |
| D-02 | 조직 보안 | 3 | 2 | `02-csap/standard-grade/implementation-guide/D02-org-security.md` |
| D-03 | 인적 보안 | 4 | 2 | `02-csap/standard-grade/implementation-guide/D03-personnel.md` |
| D-04 | 자산 관리 | 5 | 2 | `02-csap/standard-grade/implementation-guide/D04-asset-mgmt.md` |
| D-05 | 서비스 공급망 관리 | 4 | 2 | `02-csap/standard-grade/implementation-guide/D05-supply-chain.md` |
| D-06 | 침해사고 관리 | 5 | 3 | `07-operations/incident-response.md` |
| D-07 | 재해 복구 | 3 | 3 | `07-operations/backup-recovery.md` |
| D-08 | 접근 통제 | 12 | 1+2 | `01-dev-standards/secure-coding-guide.md` + `07-infra/network-security.md` |
| D-09 | 암호화 | 4 | 1 | `01-dev-standards/secure-coding-guide.md` |
| D-10 | 네트워크 보안 | 8 | 2 | `07-infra/network-security.md` |
| D-11 | 가상화 보안 | 7 | 2 | `07-infra/k3s-wsl2/cluster-setup-recipe.md` + `07-infra/container-security-baseline.md` |
| D-12 | 시스템 개발 보안 | 10 | 1 | `01-dev-standards/` 전체 + `07-infra/gitea/` |
| D-13 | 공공기관 추가 보호조치 | 10 | 2 | `02-csap/standard-grade/implementation-guide/D13-public-additional.md` |
| **합계** | | **79** | | **미매핑 목표: 0개** |

### 6.2 간편등급 31개 항목 (Phase 1 우선)

KISA 2023년 개정 고시 기준 간편등급 31개 항목은 표준등급 79개의 부분집합입니다.
`02-csap/simple-grade/checklist-simple.md`에서 31개 항목을 별도 표기하여
Phase 1에서 먼저 구현할 항목을 명확히 합니다.

**⚠️ Gap-1 주의**: 간편등급 항목 목록은 KISA 최신 고시 기준으로 확정 필요.
N2SF 2026년 시행 후 재검토 항목으로 플래그합니다.

### 6.3 CSAP 상등급 추가 요건 (Phase 3)

**⚠️ Gap-3 주의**: 상등급 추가 항목 수는 Phase 3 시작 시점에 KISA 공식 확인 후 확정.
현재는 물리적 분리, 강화된 접근통제, 실시간 보안 모니터링, 감사 로그 강화의
4개 영역에 추가 항목이 존재함을 PRD에서 확인.

---

## 7. N2SF 보안 영역 매핑

### 7.1 6개 영역 × C/S/O 등급 커버리지 계획

| 영역 ID | 보안 영역 | C등급 요건 | S등급 요건 | O등급 요건 | 커버 산출물 |
|--------|---------|---------|---------|---------|----------|
| N-01 | 권한 (Authority) | 高 | 中 | 低 | `03-n2sf/security-domains/N01-authority.md` |
| N-02 | 인증 (Authentication) | 高 | 高 | 中 | `03-n2sf/security-domains/N02-authentication.md` |
| N-03 | 분리 및 격리 (Isolation) | 必 | 中 | 低 | `03-n2sf/security-domains/N03-isolation.md` |
| N-04 | 통제 (Control) | 高 | 中 | 低 | `03-n2sf/security-domains/N04-control.md` |
| N-05 | 데이터 (Data) | 必 | 高 | 中 | `03-n2sf/security-domains/N05-data.md` |
| N-06 | 정보자산 (Assets) | 高 | 中 | 低 | `03-n2sf/security-domains/N06-assets.md` |

**완전성 기준**: 18개 셀(6영역 × 3등급) 모두 채워진 상태 = Phase 2 완료 조건

### 7.2 CSAP → N2SF 전환 매핑 계획

`03-n2sf/csap-to-n2sf-mapping.md` 파일에서 79개 CSAP 항목 각각에 대해:
- N2SF 연관 영역 (N-01 ~ N-06)
- 연관 등급 (C/S/O)
- 매핑 유형 (1:1 또는 1:N)
- 미매핑 항목: 0개 목표

**⚠️ Gap-4 주의**: N2SF 2026년 세부 기준 변경 위험. 이 섹션 전체에 "변경위험: 높음" 플래그.
국정원 N2SF 가이드라인 업데이트 모니터링 절차를 섹션 15에 포함.

---

## 8. 감리 산출물 상세 명세

### 8.1 7종 필수 산출물

| 산출물 ID | 산출물명 | 감리 단계 | 템플릿 파일 | 근거 조항 | 작성 주체 |
|---------|---------|---------|-----------|---------|---------|
| T01 | 사업계획서 | 계획 단계 | `T01-business-plan.md` | 감리기준 고시 제X조 Y항 | PM |
| T02 | 요구사항 정의서 | 분석 단계 | `T02-requirements.md` | 감리기준 고시 제X조 Y항 | PM + Dev |
| T03 | 기본 설계서 | 설계 단계 | `T03-design-basic.md` | 감리기준 고시 제X조 Y항 | Architect |
| T04 | 상세 설계서 | 설계 단계 | `T04-design-detail.md` | 감리기준 고시 제X조 Y항 | Dev |
| T05 | 시험계획서 | 시험 단계 | `T05-test-plan.md` | 감리기준 고시 제X조 Y항 | QA |
| T06 | 시험결과서 | 시험 단계 | `T06-test-result.md` | 감리기준 고시 제X조 Y항 | QA |
| T07 | 추적성 매트릭스 | 전 단계 | `traceability-matrix.md` | 감리기준 권고 사항 | PM |

**⚠️ Gap-2 주의**: 각 산출물 명칭이 행안부 고시 원문 명칭과 정확히 일치하는지 확인 필요.
근거 조항 번호는 Design 단계에서 고시 원문 대조 후 확정.

### 8.2 산출물 작성 순서 및 의존관계

```
T01 (계획) → T02 (요구사항) → T03 (기본설계) → T04 (상세설계) → T05 (시험계획) → T06 (시험결과)
                ↓                                                              ↑
               T07 (추적성 매트릭스) ─────────────────────────────────────────┘
```

---

## 9. 기술 인프라 요구사항

### k3s on WSL2 (INFR-1 ~ INFR-3)

| 항목 | 요건 |
|------|------|
| OS | WSL2 Ubuntu 22.04 LTS |
| k3s 버전 | v1.28 이상 |
| 구성 시간 | 10분 이내 (신규 환경) |
| 보안 기본값 | CSAP D-11 가상화 보안 설정 포함 |
| 확장성 | 온프레미스 전환 가이드 별도 제공 |

### Gitea + Gitea Actions (INFR-4 ~ INFR-5)

| 항목 | 요건 |
|------|------|
| Gitea 버전 | v1.20 이상 |
| Actions 호환성 | GitHub Actions 워크플로우 문법 호환 |
| 파이프라인 | 빌드·테스트·배포 3종 템플릿 |
| 외부 의존성 | 없음 (완전 자립형) |

### 네트워크 보안 (INFR-6)

| 항목 | 요건 |
|------|------|
| 폐쇄망 지원 | Airgap 환경에서 전체 시스템 동작 |
| 외부 인터넷 | AI LLM API 전용 허용 (N2SF 기준 데이터 등급 제한) |

---

## 10. AI 연동 아키텍처 요구사항

보안 게이트웨이를 통한 외부 AI API 연동 아키텍처:

```
[서비스] → [데이터 분류기] → [마스킹 엔진] → [AI 게이트웨이] → [외부 LLM API]
                                                    ↓
                                             [감사 로그 (audit.jsonl)]
                                             [Fallback 핸들러]
```

| 컴포넌트 | 역할 | 요구사항 ID |
|---------|------|----------|
| 데이터 분류기 | C/S/O 등급 자동 분류 | AI-REQ-2 |
| 마스킹 엔진 | PII 마스킹, C/S 등급 차단 | AI-REQ-2, AI-REQ-3 |
| AI 게이트웨이 | 단일 진입점, 모델 독립 | AI-REQ-1, AI-REQ-6 |
| 감사 로거 | 요청/응답 전수 기록 | AI-REQ-4 |
| Fallback 핸들러 | 장애 시 수동 전환 | AI-REQ-5 |

---

## 11. CC 하네스 요구사항

ECC v1.9.0 기반 Claude Code 오케스트레이션 요구사항.

| ID | 요구사항명 | 우선순위 | 구성 파일 |
|----|-----------|---------|---------|
| CC-REQ-1 | ECC strict 프로필 적용 | P0 | `.claude/settings.json` |
| CC-REQ-2 | ECC_GOVERNANCE_CAPTURE=1 설정 | P0 | `.claude/settings.json` |
| CC-REQ-3 | Implementer 에이전트 정의 | P0 | `.claude/agents/implementer.md` |
| CC-REQ-4 | Reviewer 에이전트 정의 | P0 | `.claude/agents/reviewer.md` |
| CC-REQ-5 | Auditor 에이전트 정의 (Opus) | P0 | `.claude/agents/auditor.md` |
| CC-REQ-6 | Tester 에이전트 정의 | P0 | `.claude/agents/tester.md` |
| CC-REQ-7 | Refactorer 에이전트 정의 (Haiku) | P1 | `.claude/agents/refactorer.md` |
| CC-REQ-8 | 7단계 품질 게이트 (Q-GATE-01~07) | P0 | `CLAUDE.md` |
| CC-REQ-9 | Dead code 정책 주간 자동 실행 | P1 | `.claude/rules/deadcode-policy.md` |
| CC-REQ-10 | CSAP/N2SF 준수 규칙 | P0 | `.claude/rules/csap-compliance.md` |

**CC 오케스트레이션 PRD 참조**: `docs/01-plan/features/cc-orchestration-prd.md`

---

## 12. Phase별 구현 계획

### Phase 1: Foundation (M1~M3)

**목표**: 개발 표준 + CSAP 간편등급 + 감리 기본 템플릿

| Month | 산출물 |
|-------|--------|
| M1 | `00-getting-started/`, `01-dev-standards/` 전체, `02-csap/simple-grade/` |
| M2 | `03-n2sf/grade-classification-guide.md`, `06-audit-compliance/templates/T01~T02` |
| M3 | `06-audit-compliance/templates/T03~T06`, `audit-checklist/`, `99-references/` |

**Phase 1 완료 게이트 기준**:
- CSAP 간편등급 31개 항목 체크리스트 완성 및 검토 완료
- 기술 PM 1인이 5일 이내 사업계획서(T01) 초안 작성 가능
- N2SF 등급 분류 가이드로 3개 상이한 서비스 유형 올바른 분류 가능
- 전 문서 한국어, 공공기관 표준 용어 준수 (NFR-8)
- CC 하네스 기본 설정 (CLAUDE.md, settings.json, 5개 에이전트) 완료

### Phase 2: Core (M4~M6)

**목표**: CSAP 표준등급 79항목 + k3s 레시피 + Gitea CI/CD

| Month | 산출물 |
|-------|--------|
| M4 | `02-csap/standard-grade/checklist-master.md`, `D01~D07 구현 가이드` |
| M5 | `D08~D13 구현 가이드`, `self-diagnosis.md`, `certification-procedure.md` |
| M6 | `03-n2sf/csap-to-n2sf-mapping.md`, `security-domains/`, `07-infra/` 전체 |

**Phase 2 완료 게이트 기준**:
- CSAP 표준등급 79개 항목 전수 커버 (미매핑 0개) (NFR-1)
- WSL2 환경에서 k3s 클러스터 10분 이내 구성 재현 성공 (INFR-2)
- CSAP↔N2SF 전환 매핑 테이블 완성 (79개 전수 매핑) (NFR-2)
- Gitea Actions 빌드·테스트·배포 파이프라인 3종 동작 확인 (INFR-5)
- 감리 체크리스트 대비 90% 이상 항목 충족 (NFR-5)

### Phase 3: Advanced (M7~M9)

**목표**: AI 연동 + 상등급 + 운영 가이드 + 감리 고급 산출물

| Month | 산출물 |
|-------|--------|
| M7 | `08-ai-integration/` 전체 (Claude API, GPT-4 포함) |
| M8 | `02-csap/high-grade/`, `06-audit-compliance/traceability-matrix.md`, `defect-response-guide.md` |
| M9 | `07-operations/` 전체, `03-n2sf/reference-architecture/` |

**Phase 3 완료 게이트 기준**:
- AI API 게이트웨이 통과 시 C/S 등급 데이터 전송 차단 확인 (AI-REQ-2)
- 추적성 매트릭스(T07): 요구사항↔설계↔시험↔CSAP 4방향 매핑 완결
- CSAP 상등급 추가 요건 파일 생성 (KISA 확인 후 확정)

### Phase 4: Ecosystem (M10~M12)

**목표**: 마켓플레이스 등록 가이드 + 커뮤니티 + 파트너 프로그램
(범위 정의는 Phase 3 완료 후 별도 Plan 문서 생성)

---

## 12. 추적성 매트릭스 (틀)

### 12.1 FR → 산출물 (FR-to-Artifact)

| FR ID | 요구사항명 | 산출물 파일 | Phase | 상태 |
|-------|-----------|-----------|-------|------|
| FR-1.1 | 보안 코딩 표준 | `01-dev-standards/coding-standards.md` | 1 | Pending |
| FR-2.1 | 표준등급 79개 체크리스트 | `02-csap/standard-grade/checklist-master.md` | 2 | Pending |
| FR-3.3 | CSAP↔N2SF 전환 매핑 | `03-n2sf/csap-to-n2sf-mapping.md` | 2 | Pending |
| ... | (전체 35개 FR 포함) | ... | ... | ... |

### 12.2 FR → 테스트 시나리오 (FR-to-TestScenario)

| FR ID | 테스트 시나리오 ID | 성공 기준 |
|-------|----------------|---------|
| FR-2.1 | TS-1 | 기술 PM이 5일 이내 CSAP 체크리스트 완성 |
| FR-5.1 | TS-2 | 개발자가 레시피만으로 k3s 클러스터 구성 성공 |
| FR-4.1 | TS-3 | 템플릿으로 사업계획서 작성, 감리 체크리스트 90%+ 충족 |
| FR-6.1 | TS-4 | AI Gateway 패턴으로 Claude API 연동 성공 |
| FR-3.1 | TS-5 | N2SF 분류 가이드로 3개 서비스 유형 올바른 등급 판정 |
| FR-3.3 | TS-6 | CSAP→N2SF 매핑 테이블로 79개 항목 전수 매핑 |

### 12.3 FR → CSAP 통제항목 (FR-to-CSAP)

| FR ID | CSAP 분야 | 통제항목 | 커버 수준 |
|-------|---------|---------|---------|
| FR-1.4 | D-08 접근통제 | AC-01~AC-12 | 부분 (D-08 12개 중 일부) |
| FR-1.4 | D-09 암호화 | CR-01~CR-04 | 완전 |
| FR-2.1 | 전체 D-01~D-13 | 79개 전수 | 완전 |
| FR-5.4 | D-11 가상화 보안 | VM-01~VM-07 | 완전 |
| ... | ... | ... | ... |

---

## 13. 성공 기준 (KPI)

| KPI ID | 지표명 | 기준값 | 목표값 | 측정 시점 | 측정 방법 |
|--------|-------|-------|-------|---------|---------|
| K-01 | CSAP 표준등급 항목 커버율 | 0% | 100% | Phase 2 완료 | 79개 × 산출물 매핑 수 |
| K-02 | N2SF 영역 매핑 완전성 | 0% | 100% | Phase 2 완료 | 18개 셀 완성 여부 |
| K-03 | 감리 산출물 템플릿 완성도 | 0/7 | 7/7 | Phase 2 완료 | 파일 존재 + 내용 검토 |
| K-04 | k3s 클러스터 구성 소요 시간 | — | 10분 이내 | Phase 2 완료 | 신규 환경 실측 평균 |
| K-05 | 감리 체크리스트 항목 충족률 | — | 90%+ | Phase 2 완료 | T01 템플릿 × 감리기준 대비 |
| K-06 | AI API 데이터 마스킹 정확도 | — | C/S 차단 100% | Phase 3 완료 | C/S 등급 데이터 전송 차단 테스트 |
| K-07 | CC 하네스 Q-Gate 자동화율 | 0% | 100% | Phase 1 완료 | G1~G7 자동 실행 확인 |
| K-08 | Dead code 비율 | — | 0% | Phase별 완료 후 | vulture + pyflakes 실행 |

---

## 14. 리스크 및 완화 전략

| Gap ID | 리스크 내용 | 영향도 | 완화 전략 |
|--------|-----------|-------|---------|
| Gap-1 | CSAP 간편등급 31개 항목 출처 미확정 | High | KISA 2023년 개정 고시 기준으로 확정, N2SF 시행 후 재검토 플래그 |
| Gap-2 | 감리 산출물 명칭 고시 원문 불일치 가능성 | Medium | Design 단계에서 고시 원문 대조, 각 템플릿에 근거 조항 번호 명시 |
| Gap-3 | CSAP 상등급 추가 항목 수 미확정 | Medium | Phase 3 시작 시점 KISA 공식 확인 후 확정 (조건부 명시) |
| Gap-4 | N2SF 2026년 세부 기준 변경 위험 | High | Module 3 전체 "변경위험: 높음" 플래그, 국정원 가이드라인 30일 이내 업데이트 절차 (NFR-7) |
| Gap-5 | Module 7 (운영 가이드) Phase 분류 | Low | P1 우선순위, Phase 3 구현으로 공식 등재 |
| Gap-6 | ECC 업스트림 업데이트 시 하네스 불일치 | Medium | ECC 버전 고정 (v1.9.0), 업데이트 시 하네스 재검토 |

---

## 15. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|---------|-------|
| 0.1.0 | 2026-04-05 | 최초 작성 (PM Agent Team PRD 기반) | Claude Code + PM Agent Team |

---

*본 문서는 행정안전부 정보시스템 감리기준(고시 제2023-1호)에 따라 작성되었습니다.*
*ECC(Everything Claude Code) v1.9.0 기반 Claude Code 하네스 엔지니어링 적용.*
