# SVC-AI-ADV R520~R528 Design — AI 고도화 서비스 (트랙 B 13차)

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: ai-impl-b
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R520-R528.plan.md

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 9개 AI 지원 도메인: 감사 대응, 서킷브레이커, 데이터 검색, 프로비저닝, 유지보수, 카탈로그, 서비스 품질, 메시 최적화, 내부 감사 |
| 기술 | TypeScript strict, Map 기반 레지스트리, append-only 감사 로그, 불변 복사본 반환 패턴 |
| 운영 | 모든 구현체 독립 클래스, 외부 의존성 없음, 메모리 내 처리 |
| 규제 | CSAP D-06 감사 로그, N2SF N-05 C/S등급 차단, CSAP D-12 입력 검증 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공 SaaS 운영 자동화: 사람 개입 없이 감사·장애·인프라 최적화 처리 |
| WHO | 공공기관 IT 운영팀, 내부 감사 담당자, 인프라 관리자 |
| RISK | 서킷브레이커 상태 전환 오류 시 연쇄 장애; N2SF 차단 미적용 시 정보 유출 |
| SUCCESS | TypeScript 0 에러, ESLint 0 경고, Vitest 68개 전 통과 |
| SCOPE | 구현 9개 + 테스트 9개 파일 |

---

## 모듈별 설계

### R520: AuditResponseAutomatorV2

- `registerFinding(finding)`: 감사 지적사항 등록
- `generateResponse(findingId)`: CRITICAL→즉시조치, MAJOR→30일 계획 자동 생성
- `resolve(findingId)`: 완료 처리 (resolvedAt 기록)
- `generateReport(today)`: complianceScore = 100 - critical×20 - overdue×10

### R521: IntelligentCircuitBreakerAI

- 상태: CLOSED → OPEN (실패율≥임계값 OR 지연율≥임계값)
- OPEN → HALF_OPEN (openDurationMs 경과 후 다음 호출 시)
- 슬라이딩 윈도우: windowSize 기준 최근 N개 호출 분석

### R522: PublicDataSearchIntelligenceV2

- N2SF: C/S등급 `registerDataset()` 호출 시 `BLOCKED` 오류 즉시 반환
- matchScore = 키워드(60%) + 인기도(max 20) + 최신성(≤30일=20)
- `suggestions`: 상위 결과 태그에서 추출

### R523: InfraProvisioningOptimizerAI

- SCALE_DOWN: avgUsage<20% AND currentCpu<20%
- SCALE_OUT(COMPUTE)/SCALE_UP(other): avgUsage>80% OR currentCpu>85%
- 월 절감 = saving×720시간 합산

### R524: PredictiveMaintenanceR524AI

- riskScore 누적: 노후(+30/+15), 미유지보수(+20/+10), 오류(+30/+10), 과열(+25), 디스크불량(+35)
- CRITICAL≥70→IMMEDIATE, HIGH≥50→URGENT, MEDIUM≥25→SOON, LOW→SCHEDULED
- 파일명 suffix: `predictive-maintenance-r524-ai.ts` (R252 충돌 회피)

### R525: ServiceCatalogValidatorV2

- `checkRequiredFields()` 분리: owner(CRITICAL), description(ERROR), endpoints(WARNING), slaTarget(WARNING), tags(INFO), lastReview(WARNING)
- `checkDependencies()` 분리: 미등록 의존 서비스 → ERROR
- validationScore = 100 - errorCount×15 - warningCount×5

### R526: DigitalServiceQualityAIV2

- 5차원 가중 평균: USABILITY×0.25, ACCESSIBILITY×0.2, PERFORMANCE×0.2, SECURITY×0.2, RELIABILITY×0.15
- grade: A≥90, B≥75, C≥60, D≥40, F
- benchmarkComparison: ABOVE_AVERAGE≥75, AVERAGE≥55, BELOW_AVERAGE

### R527: ServiceMeshOptimizerV3

- 지연 오름차순 정렬 → 역순 가중치 배분 (지연 낮은 엔드포인트 = 높은 가중치)
- 정책: errorRate>5%→LEAST_CONN, LATENCY→WEIGHTED, THROUGHPUT→LEAST_CONN, else→ROUND_ROBIN
- highLatencyRoutes: avgLatency>500ms, highErrorRoutes: avgError>5%

### R528: InternalAuditAutomatorV2

- INEFFECTIVE + lastTested>365d → CRITICAL
- INEFFECTIVE + lastTested≤365d → HIGH
- EFFECTIVE + lastTested>365d → MEDIUM (UNTEST finding)
- evidenceCount=0 → LOW (NOEVID finding)
- overallRiskRating: CRITICAL>HIGH>MEDIUM>LOW 우선순위

---

## 추적성 매트릭스

| 요구사항 ID | 구현 파일 | 테스트 파일 | CSAP 항목 |
|------------|---------|-----------|----------|
| R520 | audit-response-automator-v2.ts | audit-response-automator-v2.test.ts | D-06 |
| R521 | intelligent-circuit-breaker-ai.ts | intelligent-circuit-breaker-ai.test.ts | D-08 |
| R522 | public-data-search-intelligence-v2.ts | public-data-search-intelligence-v2.test.ts | N2SF N-05 |
| R523 | infra-provisioning-optimizer-ai.ts | infra-provisioning-optimizer-ai.test.ts | D-12 |
| R524 | predictive-maintenance-r524-ai.ts | predictive-maintenance-r524-ai.test.ts | D-06 |
| R525 | service-catalog-validator-v2.ts | service-catalog-validator-v2.test.ts | D-12 |
| R526 | digital-service-quality-ai-v2.ts | digital-service-quality-ai-v2.test.ts | D-06 |
| R527 | service-mesh-optimizer-v3.ts | service-mesh-optimizer-v3.test.ts | D-08 |
| R528 | internal-audit-automator-v2.ts | internal-audit-automator-v2.test.ts | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
