# Phase 2 잔여 MTU PRD — Core Security 완성

> **Phase**: Phase 2 Core Security (잔여 3 MTU)
> **작성일**: 2026-04-05
> **상태**: Draft
> **작성자**: PM Lead Agent
> **대상 MTU**: MTU-C5, MTU-C7, MTU-C8

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | Phase 2에서 CSAP 79항목 마스터 체크리스트(C1), 구현 가이드(C2a/C2b/C3), N2SF 매핑(C4)은 완료되었으나 N2SF 6영역 통제(C5), Policy as Code(C7), 공급망 보안(C8)이 미완료 상태 |
| **솔루션** | 잔여 3개 MTU를 병렬/순차 조합으로 착수하여 Phase 2 완료 게이트 달성 |
| **기능/UX 효과** | N2SF 6영역 전수 통제 가이드 + k3s 정책 자동 적용 + SBOM/이미지 서명으로 보안 자동화 완성 |
| **핵심 가치** | CSAP 79항목 100% 커버 + N2SF 전수 매핑 완성 = Phase 2 완료 게이트 충족 |

---

## 1. Context Anchor

### WHY (왜 지금 해야 하는가)

1. **Phase 2 완료 게이트 미충족**: "CSAP 79항목 100% 커버 + N2SF 전수 매핑" 기준 중 N2SF 6영역 통제 가이드(C5)가 없으면 매핑만 있고 구현 방법이 부재
2. **Phase 3 의존성 차단**: MTU-C8은 MTU-I2(Gitea CI/CD)에 의존하지만 문서 구조는 선행 작성 가능
3. **규제 긴급성**: N2SF 가이드라인 1.0이 2025년 발표되어 2026년 현재 시행 초기 — 선제 대응 필수

### WHO (이해관계자)

| 역할 | 관심사 | 영향도 |
|------|--------|--------|
| 보안 담당자 | N2SF 6영역별 C/S/O 등급 통제 요건 구현 | 매우 높음 |
| DevOps 엔지니어 | Kyverno/OPA 정책 적용, SBOM 자동화 | 높음 |
| 감리관 | CSAP 통제→N2SF 매핑→구현 증적 추적성 | 매우 높음 |
| PM | Phase 2 완료 및 Phase 3 착수 가능 여부 | 높음 |

### RISK (위험 요소)

| ID | 위험 | 영향도 | 대응 방안 |
|----|------|--------|----------|
| R-P2-01 | MTU-C8이 MTU-I2(미완료)에 의존하여 실행 검증 불가 | 중간 | 문서+예시 코드까지 선행 작성, 실행 검증은 I2 완료 후 수행 |
| R-P2-02 | Kyverno/OPA 하이브리드 구성 복잡도 | 중간 | 단순 정책은 Kyverno, 복잡 정책만 OPA로 분리하여 범위 한정 |
| R-P2-03 | N2SF 가이드라인 1.0 해석 모호성 | 낮음 | 국정원 가이드라인 원문 + 보안 기업 해석 교차 검증 |

### SUCCESS (성공 기준)

| ID | 기준 | 측정 방법 |
|----|------|----------|
| SC-P2-01 | N2SF N01~N06 6개 영역 전수 구현 가이드 완성 | MTU-C5 산출물 6개 파일 존재 + C/S/O 테이블 완비 |
| SC-P2-02 | Kyverno 정책 8개 + OPA 정책 2개 이상 | MTU-C7 산출물 CSAP ID 매핑 확인 |
| SC-P2-03 | SBOM 생성 + Cosign 서명 가이드 완성 | MTU-C8 산출물 2개 파일 + CSAP-D05 매핑 |
| SC-P2-04 | Phase 2 완료 게이트 통과 | Auditor Q-Gate G6 CSAP Phase 100% |

### SCOPE (범위)

| 구분 | 포함 | 미포함 |
|------|------|--------|
| In Scope | N2SF 6영역 통제 가이드, Kyverno/OPA 정책 YAML, SBOM/Sigstore 가이드 | 실행 환경 구축 (Phase 3), ISMS-P (Phase 3 이동됨) |
| 의존 MTU | MTU-C4(완료), MTU-I1(완료), MTU-I2(미완료, C8만 해당) | - |

---

## 2. MTU별 상세 분석

### MTU-C5: N2SF 6개 영역 통제 구현 가이드

**목적**: N2SF 6개 보안 영역(N01~N06) C/S/O 등급별 통제 요건 + CSAP 역참조 완비

**시장조사 반영 (2026-04)**:
- N2SF 가이드라인 1.0 발표 완료 — 6개 보안통제 항목: 권한, 인증, 분리 및 격리, 통제, 데이터, 정보자산
- 파수 등 주요 보안 기업이 N2SF 대응 솔루션 출시 시작 (2026년 3월)
- N2SF MLS(다층보안) 파일럿 예정 (2027년) — MLS 전환 로드맵 선행 설계 필수

**복잡도 평가**: MED (산출물 6개, 코드 구현 없음, 구현 가이드 포함)
- 의존: MTU-C4 (완료) -- 착수 가능

**산출물**: 6개 파일 (`docs/framework/03-n2sf/domains/N01~N06`)
**예상 세션**: 1 세션
**Plan 파일**: `docs/01-plan/mtus/MTU-C5-n2sf-domains.plan.md` (존재)

---

### MTU-C7: Policy as Code (Kyverno/OPA)

**목적**: k3s 클러스터에서 CSAP 보안 정책을 코드로 자동 적용

**시장조사 반영 (2026-04)**:
- Kyverno: CNCF Incubating, YAML 네이티브 정책 — k8s 팀 학습 비용 최소
- OPA Gatekeeper: CNCF Graduated, Rego 언어 — 복잡한 컴플라이언스 로직에 적합
- 2026년 권장: 하이브리드 접근 (단순→Kyverno, 복잡→OPA)
- EU CRA(사이버복원력법) 대비 Policy as Code 필수화 추세

**복잡도 평가**: HIGH (인프라 보안, 산출물 3개 + CSAP/N2SF 매핑 정책 10개+)
- 의존: MTU-I1 (완료) -- 착수 가능

**산출물**: 3개 파일 (`docs/framework/07-infra/policy-as-code/`)
**예상 세션**: 2 세션
**Plan 파일**: `docs/01-plan/mtus/MTU-C7-policy-as-code.plan.md` (존재)

---

### MTU-C8: Supply Chain Security (SBOM + Sigstore)

**목적**: 소프트웨어 공급망 보안 SBOM 자동 생성 + Cosign 이미지 서명

**시장조사 반영 (2026-04)**:
- EU CRA SBOM 의무화, SLSA 1.0 표준 확정 (2025)
- Sigstore/Cosign 표준화 완성, keyless signing 안정화
- CSAP-D05 공급망 관리 4항목 자동화 매핑 완비
- 국정원 공급망 보안 지침 강화 추세

**복잡도 평가**: MED (산출물 2개, Gitea Actions 연동 예시)
- 의존: MTU-I2 (미완료) -- 문서는 선행 작성 가능, 실행 검증은 I2 후

**산출물**: 2개 파일 (`docs/framework/07-infra/supply-chain/`)
**예상 세션**: 1 세션
**Plan 파일**: `docs/01-plan/mtus/MTU-C8-supply-chain-security.plan.md` (존재)

---

## 3. 우선순위 매트릭스

| MTU | 영향도 (1~5) | 긴급도 (1~5) | 난이도 (1~5) | 총점 | 착수 가능 | 병렬 가능 |
|-----|-------------|-------------|-------------|------|----------|----------|
| **MTU-C5** | 5 (N2SF 전수 필수) | 4 (C4 후속, A1 선행) | 3 (6파일 문서) | **12** | 즉시 | 독립 착수 |
| **MTU-C7** | 5 (CSAP 자동화 핵심) | 4 (I1 후속, 다수 의존) | 4 (인프라 보안) | **13** | 즉시 | 독립 착수 |
| **MTU-C8** | 4 (공급망 보안) | 3 (I2 의존 있음) | 3 (2파일 문서) | **10** | 부분 (문서만) | C5/C7과 병렬 |

**착수 순서 권장**: C5 + C7 병렬 착수 → C8 문서 선행 작성

---

## 4. 착수 그룹핑

### 그룹 A: 즉시 병렬 착수 (의존 충족)

| MTU | 의존 MTU | 상태 | 착수 조건 |
|-----|---------|------|----------|
| MTU-C5 | MTU-C4 | 완료 | 즉시 착수 |
| MTU-C7 | MTU-I1 | 완료 | 즉시 착수 |

### 그룹 B: 문서 선행 + 검증 대기

| MTU | 의존 MTU | 상태 | 착수 조건 |
|-----|---------|------|----------|
| MTU-C8 | MTU-I2 | 미완료 | 문서 작성 가능, 실행 검증은 I2 후 |

---

## 5. Phase 2 완료 게이트 체크리스트

| 항목 | 기준 | 현재 상태 |
|------|------|----------|
| CSAP 79항목 100% 커버 | C1(79항목) + C2a(D01~D04) + C2b(D05~D07) + C3(D08~D13) | 완료 |
| N2SF 전수 매핑 | C4 (79항목 x 6영역) | 완료 |
| N2SF 6영역 통제 가이드 | C5 (N01~N06) | **미완료** |
| Policy as Code | C7 (Kyverno/OPA) | **미완료** |
| Supply Chain Security | C8 (SBOM/Sigstore) | **미완료** |

---

## 6. 추적성 매트릭스

| FR ID | MTU | CSAP 항목 | N2SF 영역 | 산출물 |
|-------|-----|---------|---------|--------|
| FR-3.3 | C5 | D01~D13 역참조 | N01~N06 | domains/N01~N06.md |
| FR-3.4 | C5 | - | N01~N06 | C/S/O 비교 테이블 |
| FR-3.5 | C5 | CSAP-DXX-YY | N01~N06 | 역참조 링크 |
| FR-9.1 | C7 | D08/D09/D10/D11/D12/D06 | N03/N05 | kyverno-policies.md |
| FR-9.2 | C7 | - | N03/N05 | opa-gatekeeper.md |
| FR-9.3 | C7 | - | - | kubectl 검증 명령 |
| FR-10.1 | C8 | D05-01~04 | - | sbom-guide.md |
| FR-10.2 | C8 | D05-03 | - | sigstore-signing.md |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Phase 2 잔여 3 MTU PRD | PM Lead Agent |
