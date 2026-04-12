# MTU-N561~N580 — R15 E2E 시나리오 Design

> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead
> **선행 Plan**: docs/01-plan/mtus/MTU-N561-N580-r15-e2e.plan.md

---

## 1. Executive Summary

| 관점 | 결정 | 근거 |
|------|------|------|
| 비즈니스 | 5개 E2E 시나리오 파일 분리 | 시나리오별 독립 실행, 디버깅 용이 |
| 기술 | Vitest + service-validator 헬퍼 재사용 | 기존 7개 시나리오와 일관성 |
| 보안 | 모든 시나리오에 audit/RBAC/CSAP 검증 단계 포함 | CSAP D-06/D-08/D-12 |
| 운영 | 코드 수준 정적 검증 (서비스 기동 X) | CI 환경 호환성, 빠른 실행 |

---

## 2. Context Anchor (Design)

- **WHY**: 기존 E2E 7개(audit-trail, auth-flow, ai-data-grade, gateway-routing, security-events, service-architecture, tenant-isolation)는 보안/인프라 중심. 비즈니스 시나리오/AI 위임/SLO 흐름 미검증.
- **WHO**: Vitest 기반 CI 파이프라인, PM Lead, 감사관
- **RISK**: 실행 환경(서비스 기동) 의존 시 CI 불안정 → 정적 코드 검증 패턴 채택
- **SUCCESS**: `pnpm vitest run --config platform/tests/e2e/vitest.config.ts` 0 fail
- **SCOPE**: 5개 파일, 각 50줄~200줄

---

## 3. 아키텍처 옵션

### 옵션 A: Playwright + 실제 서비스 기동 (배제)
- 장점: 실제 행동 검증
- 단점: docker 인프라 필요, CI 비용 ↑, 30초 이상 소요
- **결정: 배제** — 기존 패턴과 불일치

### 옵션 B: Vitest + 코드 정적 검증 (선택) ★ Pragmatic Balance
- 장점: 기존 7개 시나리오와 동일 패턴, 빠른 실행, CI 안정성
- 단점: 런타임 행동 미검증
- **결정: 채택** — 단위 테스트 220+가 런타임 검증 담당, E2E는 통합 흐름 추적 검증

### 옵션 C: 하이브리드 (배제)
- 복잡성 ↑, 일관성 ↓

---

## 4. 시나리오별 설계

### 시나리오 1: civil-petition-automation.e2e.test.ts (FR-N561)

**검증 단계**:
1. `civil-petition-automation.ts` 모듈 존재
2. 민원 분류 함수 정의
3. AI 응답 생성 연동 (`ai-agent.ts`)
4. 만족도 예측 (`civil-satisfaction-predictor.ts`)
5. 감사 로그 (`ai-service/src/lib/audit.ts`) 호출
6. tenant 격리 (handler tenantId 사용)
7. CSAP D-06 audit append

### 시나리오 2: ai-agent-delegation.e2e.test.ts (FR-N571)

**검증 단계**:
1. `agent-orchestrator.ts` 위임 함수
2. `agent-planner.ts` 계획 수립
3. `agent-rbac.ts` 권한 검증
4. `agent-memory.ts` 컨텍스트 보관
5. `agent-audit-trail.ts` 작업 추적
6. `agent-versioning.ts` 버전 관리
7. `agent-marketplace.ts` 통합

### 시나리오 3: tenant-onboarding.e2e.test.ts (FR-N575)

**검증 단계**:
1. `tenant-onboarding-ai.ts` 자동화 모듈
2. `tenant-service/handlers/tenant.handler.ts` 생성 API
3. `tenant-stats.handler.ts` 초기 통계
4. `tenant-usage.handler.ts` 사용량 집계
5. 멀티테넌트 격리 (tenantId 필터)
6. 온보딩 감사 로그
7. menu-service 기본 메뉴 매핑

### 시나리오 4: csap-evidence-collection.e2e.test.ts (FR-N578)

**검증 단계**:
1. `compliance-service/lib/csap-evidence-collector.ts` 존재
2. `compliance.handler.ts` 증적 API
3. `compliance-trend.handler.ts` 추세
4. `platform-maturity-engine.ts` 성숙도
5. `audit.ts` 감사 통합
6. `.gitea/workflows/csap-evidence.yml` 워크플로우 존재
7. 무결성 (append-only / 해시)

### 시나리오 5: slo-error-budget.e2e.test.ts (FR-N580)

**검증 단계**:
1. `packages/slo-escalation/src/escalation-controller.ts`
2. `packages/slo-escalation/src/error-budget-policy.ts`
3. `packages/dora-exporter/src/index.ts`
4. `packages/dora-exporter/src/lead-time.ts`
5. `packages/dora-exporter/src/change-failure.ts`
6. `packages/dora-exporter/src/mttr-tracker.ts`
7. `.gitea/workflows/dora-gate.yml`

---

## 5. Session Guide

### 구현 순서
1. `civil-petition-automation.e2e.test.ts` 작성
2. `ai-agent-delegation.e2e.test.ts` 작성
3. `tenant-onboarding.e2e.test.ts` 작성
4. `csap-evidence-collection.e2e.test.ts` 작성
5. `slo-error-budget.e2e.test.ts` 작성
6. `pnpm vitest run --config platform/tests/e2e/vitest.config.ts` 실행
7. 0 fail 확인

### 주의사항
- 모든 파일 헤더에 `// Design Ref: MTU-N561-N580 §X`, `// Plan SC: FR-NXXX.X` 표기
- `service-validator.ts` 헬퍼 사용 (PROJECT_ROOT 기준 상대 경로)
- 파일 경로는 `packages/`(루트) 또는 `platform/...` 둘 다 사용 — 본 프로젝트는 양쪽 다 존재

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성, 옵션 B 채택 | PM Lead |
