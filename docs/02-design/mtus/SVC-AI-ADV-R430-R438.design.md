# SVC-AI-ADV R430~R438 Design — AI 고도화 서비스 (트랙 B 10차)

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: ai-impl-b

---

## §R430 — ErrorBudgetManagerV2

**파일**: `platform/services/ai-service/src/lib/error-budget-manager-v2.ts`

- `registerSLO(slo)`: SLO 등록 (target, windowDays 포함)
- `recordObservation(obs)`: 실제 측정값 기록
- `getReport(sloId)`: 허용 오류(1-target) 대비 평균 목표 미달 비율로 consumed 계산; HEALTHY/AT_RISK/CRITICAL/EXHAUSTED 상태

---

## §R431 — PublicPortalAnalyticsAI

**파일**: `platform/services/ai-service/src/lib/public-portal-analytics-ai.ts`

- `ingest(visit)`: N2SF C/S 등급 차단; 방문 데이터 수집
- `analyze()`: 이탈률·평균 체류·카테고리 집계(상위 3)·디바이스 분포·인사이트 생성
- 인사이트: 이탈률>60%, 체류<30초, 모바일>50%, 최다 카테고리 자동 도출

---

## §R432 — ApiBackwardCompatibilityCheckerV2

**파일**: `platform/services/ai-service/src/lib/api-backward-compatibility-checker-v2.ts`

- `registerSchema(schema)`: API 버전별 스키마 등록
- `check(apiId, oldVersion, newVersion)`: 엔드포인트 제거(CRITICAL)·응답 필드 제거(HIGH)·타입 변경(HIGH)·필수 요청 필드 추가(HIGH)·상태 코드 제거(MEDIUM) 탐지
- BREAKING/WARNING/COMPATIBLE 상태 반환

---

## §R433 — RealtimeDependencyTrackerAI

**파일**: `platform/services/ai-service/src/lib/realtime-dependency-tracker-ai.ts`

- `addLink(link)`: 양쪽 서비스 등록 여부 검사
- `updateHealth(update)`: 서비스별 이력 기록
- `getAlerts()`: DOWN+critical→CRITICAL, DOWN→HIGH, DEGRADED+critical→HIGH, DEGRADED→MEDIUM; 의존 서비스(impactedServices) 포함
- `getCurrentStatus(serviceId)`: 최신 상태 반환

---

## §R434 — OrgCapabilityEnhancerAI

**파일**: `platform/services/ai-service/src/lib/org-capability-enhancer-ai.ts`

- `registerStaff(profile)`: N2SF C/S 등급 차단; 부서별 직원 등록
- `assess(departmentId)`: BEGINNER=25/INTERMEDIATE=50/ADVANCED=75/EXPERT=100 점수 기반 도메인 평균; 점수<50 → weakDomains; 점수≥75 → strongDomains; 교육 권고 생성

---

## §R435 — SecurityVulnResponderV2

**파일**: `platform/services/ai-service/src/lib/security-vuln-responder-v2.ts`

- `reportVuln(vuln)`: 취약점 등록
- `respond(vulnId)`: 유형별 액션 — CVE→PATCH, EXPOSED_SECRET→ROTATE_SECRET+BLOCK_PORT, MISCONFIG→RECONFIGURE, OPEN_PORT→BLOCK_PORT, INSECURE_DEPENDENCY→UPDATE_DEPENDENCY; CRITICAL→+ESCALATE
- SLA: CRITICAL=4h, HIGH=24h, MEDIUM=72h, LOW/INFO=168h
- `resolve(vulnId)`: resolved=true 마킹

---

## §R436 — ServiceCatalogAutoTaggerAI

**파일**: `platform/services/ai-service/src/lib/service-catalog-auto-tagger-ai.ts`

- `tag(entry)`: 도메인(auth/billing/notification 등) + 컴플라이언스(csap/n2sf/csap-d06 등) + 크리티컬리티 태그 자동 생성; 소유자 태그(owner:X); 기존 태그 중복 제거

---

## §R437 — PublicDataOpennessAutomatorV2

**파일**: `platform/services/ai-service/src/lib/public-data-openness-automator-v2.ts`

- `evaluate(datasetId)`: C/S→REJECTED(openScore=0); O등급: PII 필드 식별→REDACTED_APPROVED; openScore=100-PII비율×40-민감필드×5; 점수≥70→APPROVED; 미달→PENDING_REVIEW

---

## §R438 — ServicePricingOptimizerAI

**파일**: `platform/services/ai-service/src/lib/service-pricing-optimizer-ai.ts`

- `optimize(tenantId)`: 평균 사용량 커버 가능한 최소 비용 요금제 탐색; 절감액>0→DOWNGRADE/SWITCH_PLAN; 절감액≤0→UPGRADE/KEEP; utilizationRate=avgUnits/includedUnits

---

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 파일 | CSAP 항목 |
|-------|----------|------------|----------|
| SVC-AI-ADV-R430 | error-budget-manager-v2.ts | ...test.ts | D-06 |
| SVC-AI-ADV-R431 | public-portal-analytics-ai.ts | ...test.ts | D-06, N2SF |
| SVC-AI-ADV-R432 | api-backward-compatibility-checker-v2.ts | ...test.ts | D-06, D-12 |
| SVC-AI-ADV-R433 | realtime-dependency-tracker-ai.ts | ...test.ts | D-06, D-08 |
| SVC-AI-ADV-R434 | org-capability-enhancer-ai.ts | ...test.ts | D-06, N2SF |
| SVC-AI-ADV-R435 | security-vuln-responder-v2.ts | ...test.ts | D-06, D-08, D-09, D-12 |
| SVC-AI-ADV-R436 | service-catalog-auto-tagger-ai.ts | ...test.ts | D-06 |
| SVC-AI-ADV-R437 | public-data-openness-automator-v2.ts | ...test.ts | D-06, N2SF |
| SVC-AI-ADV-R438 | service-pricing-optimizer-ai.ts | ...test.ts | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
