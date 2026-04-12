# MTU-N561~N580 — R15 E2E 시나리오 통합 검증 Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead
> **카테고리**: E2E Test / Quality Assurance
> **선행 MTU**: R1~R14 (AI service 292개 모듈 + 11개 패키지 + 포털 11개 + API 라우트 20개)

---

## 1. Executive Summary (4-Perspective)

| 관점 | 핵심 지표 | 목표 |
|------|----------|------|
| 비즈니스 | E2E 종단간 검증 시나리오 수 | 5개 핵심 플로우 |
| 기술 | E2E 테스트 케이스 수 | 50개 이상 |
| 보안 | CSAP 감사 추적 시나리오 커버리지 | 100% |
| 운영 | E2E 테스트 통과율 | 100% (Vitest) |

---

## 2. Context Anchor

- **WHY**: R1~R14에서 구현된 292개 AI 모듈, 11개 패키지, 포털 컴포넌트, 20개 API 라우트가 종단간 시나리오에서 일관된 행동을 보이는지 검증 필요. 단위 테스트만으로는 시나리오 흐름 검증 불가.
- **WHO**: 공공기관 운영자, AI 에이전트 사용자, 다중 테넌트 관리자, CSAP 감사관, SRE 엔지니어
- **RISK**: E2E 시나리오 누락 시 통합 결함 발견 지연 → 운영 사고 위험 ↑. CSAP 감사 추적 누락 시 인증 실패.
- **SUCCESS**: 5개 핵심 시나리오 모두 코드 수준 검증 통과 + Vitest 실행 시 0 fail
- **SCOPE**: `platform/tests/e2e/scenarios/` 디렉토리에 5개 E2E 파일 추가

---

## 3. Functional Requirements

| FR ID | 요구사항 | 검증 방법 | CSAP 매핑 |
|-------|---------|---------|----------|
| FR-N561.1 | 공공기관 민원 자동 처리 플로우 검증 | civil-petition-automation 모듈 + ai-agent + audit | D-06, D-12 |
| FR-N561.2 | 민원 분류 → 응답 생성 → 감사 기록 일관성 | 3단계 코드 추적 | D-06 |
| FR-N571.1 | AI 에이전트 위임 → 실행 → 결과 검증 플로우 | agent-orchestrator + agent-planner + agent-rbac | D-08 |
| FR-N571.2 | 위임 작업의 RBAC 검증 | agent-rbac 코드 검증 | D-08 |
| FR-N571.3 | 실행 결과 감사 추적 | agent-audit-trail 검증 | D-06 |
| FR-N575.1 | 멀티테넌트 온보딩 자동화 | tenant-onboarding-ai + tenant-service | D-08, D-12 |
| FR-N575.2 | 테넌트 격리 검증 | tenant.handler RBAC | D-08 |
| FR-N578.1 | CSAP 감사 증적 자동 수집 플로우 | csap-evidence-collector + compliance-service | D-06 |
| FR-N578.2 | 증적 무결성 (해시/append-only) | audit.ts + compliance audit | D-06 |
| FR-N580.1 | SLO 위반 → 에러 버짓 소진 → 자동 대응 | slo-escalation + error-budget-policy + escalation-controller | NFR |
| FR-N580.2 | DORA 4-key 메트릭 흐름 검증 | dora-exporter 4 모듈 | NFR |

---

## 4. Non-Functional Requirements

- **NFR-N561.1**: Vitest 실행 시간 30초 이하 (테스트 파일당)
- **NFR-N561.2**: 코드 수준 검증 (서비스 기동 불필요) — 기존 helpers/service-validator.ts 패턴 재사용
- **NFR-N561.3**: TypeScript strict 컴파일 0 오류

---

## 5. 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|-------|-------|------|
| FR-N561.* | civil-petition-automation.e2e.test.ts | Vitest 10+ | D-06, D-12 |
| FR-N571.* | ai-agent-delegation.e2e.test.ts | Vitest 10+ | D-08, D-06 |
| FR-N575.* | tenant-onboarding.e2e.test.ts | Vitest 10+ | D-08, D-12 |
| FR-N578.* | csap-evidence-collection.e2e.test.ts | Vitest 10+ | D-06 |
| FR-N580.* | slo-error-budget.e2e.test.ts | Vitest 10+ | NFR |

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성, R15 E2E 시나리오 정의 | PM Lead |
