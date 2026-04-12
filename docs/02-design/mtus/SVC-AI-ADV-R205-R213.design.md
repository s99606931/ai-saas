# SVC-AI-ADV R205~R213 설계서 (트랙 B 7차)

> **작성일**: 2026-04-12 | **버전**: 1.0.0

---

## §1. R205 — MultiAgentOrchestratorV2

- N2SF: `submit()` 진입 시 grade C/S → BLOCKED throw
- 의존성 검사: `dependsOn` 내 모든 taskId가 `DONE` 상태여야 함
- 동기 모의 실행: `output = [agentId] processed: {input}`, `status = DONE`
- CSAP D-06: `agent.register`, `task.submit`, `task.complete` 감사 로그

## §2. R206 — RealtimeSecurityEventClassifier

- 카테고리 패턴: AUTH/NETWORK/DATA/SYSTEM 키워드 목록 매칭
- rawScore 있으면 직접 위협 수준 결정 (≥0.9→CRITICAL, ≥0.7→HIGH, ≥0.4→MEDIUM, ≥0.2→LOW, else INFO)
- rawScore 없으면 CRITICAL_TERMS(×0.3), HIGH_TERMS(×0.15) 누적 점수
- 완화 권고: 카테고리+위협수준 조합 문자열

## §3. R207 — ProcurementRiskAssessorAI

| 리스크 요인 | 가산점 |
|------------|--------|
| 입찰 2개 미만 | +30 |
| 단독 입찰 | +20 |
| 긴급 조달 | +20 |
| 10억 이상 | +15 |
| 덤핑 (min < avg×0.7) | +25 |

- riskLevel: ≥70→VERY_HIGH, ≥45→HIGH, ≥20→MEDIUM, else LOW

## §4. R208 — SloOptimizerAI

- errorBudget = 1 - targetAvailability
- consumedBudget = max(0, (1-measuredAvailability) - errorBudget)
- budgetRemaining = max(0, 1 - consumedBudget/errorBudget)
- atRisk: budgetRemaining < 0.2 || burnRate > 0.1

## §5. R209 — KnowledgeBaseBuilderAI

- N2SF: `ingest()` 진입 시 grade C/S → BLOCKED throw
- wordCount = content.split(/\s+/).filter(w=>w.length>0).length
- search: title+content+tags 합산 텍스트에서 queryToken 매칭률 = relevanceScore

## §6. R210 — UiPersonalizationEngine

- highContrastMode = accessibilityNeeds.includes('high_contrast')
- fontSize: large_font→LARGE, small_font→SMALL, else MEDIUM
- layoutPreference: ADMIN→COMPACT, VIEWER→SPACIOUS, else COMFORTABLE
- topModules: 사용 빈도 내림차순 상위 5개 feature

## §7. R211 — DeploymentRiskAssessorAI

| 요인 | 가산점 |
|------|--------|
| PRODUCTION 환경 | +20 |
| DB 마이그레이션 | +30 |
| 설정 변경 | +15 |
| 롤백 미비 | +20 |
| 변경 50개+ | +20 |
| 변경 20개+ | +10 |

- approvalRequired: CRITICAL 또는 HIGH

## §8. R212 — CodeQualityImproverAI

- 감점: CRITICAL×20 + HIGH×10 + MEDIUM×5 + LOW×1
- qualityScore = max(0, 100 - deduction)
- passed: CRITICAL=0 && qualityScore≥60
- topIssues: severity 우선순위 정렬 상위 5개

## §9. R213 — IncidentAutoResponderAI

| 심각도 | PAGE_ONCALL | SCALE_OUT | 해결 시간 |
|--------|------------|-----------|---------|
| P1 | O (PRIMARY) | O | 30분 |
| P2 | O (SECONDARY) | O | 60분 |
| P3 | - | O | 240분 |
| P4 | - | - | 480분 |

- 공통: ENABLE_CIRCUIT_BREAKER + NOTIFY_STAKEHOLDERS
- runbookUrl = `/runbooks/{affectedService}`

---

## 추적성 매트릭스

| MTU | 구현 파일 | 테스트 파일 | CSAP |
|-----|---------|----------|------|
| R205 | multi-agent-orchestrator-v2.ts | __tests__/multi-agent-orchestrator-v2.test.ts | D-06, N2SF |
| R206 | realtime-security-event-classifier.ts | __tests__/realtime-security-event-classifier.test.ts | D-06 |
| R207 | procurement-risk-assessor-ai.ts | __tests__/procurement-risk-assessor-ai.test.ts | D-06 |
| R208 | slo-optimizer-ai.ts | __tests__/slo-optimizer-ai.test.ts | D-06 |
| R209 | knowledge-base-builder-ai.ts | __tests__/knowledge-base-builder-ai.test.ts | D-06, N2SF |
| R210 | ui-personalization-engine.ts | __tests__/ui-personalization-engine.test.ts | D-06 |
| R211 | deployment-risk-assessor-ai.ts | __tests__/deployment-risk-assessor-ai.test.ts | D-06 |
| R212 | code-quality-improver-ai.ts | __tests__/code-quality-improver-ai.test.ts | D-06, D-12 |
| R213 | incident-auto-responder-ai.ts | __tests__/incident-auto-responder-ai.test.ts | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 | ai-impl-b |
