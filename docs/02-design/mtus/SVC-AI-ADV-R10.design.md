# SVC-AI-ADV R313~R321 Design — 트랙 A 10차

> **Plan 참조**: `docs/01-plan/mtus/SVC-AI-ADV-R10.plan.md`
> **작성일**: 2026-04-13
> **작성자**: ai-impl-a
> **버전**: 1.0.0

---

## R313: DigitalTransformationAssessorAi

- 차원별 가중 점수 합산 → overallScore
- ≥90→OPTIMIZING / ≥75→MANAGED / ≥60→DEFINED / ≥40→DEVELOPING / INITIAL
- 점수 ≥80→STRONG / ≥60→ADEQUATE / <60→WEAK + 권고사항

---

## R314: ServiceMaturityAssessorAi

- 가용성(20)/응답시간(20)/배포빈도(20)/MTTR(20)/모니터링(5)/알림(5)/CI-CD(5)/커버리지(5) 총 100점
- ≥90→L5 / ≥75→L4 / ≥55→L3 / ≥35→L2 / L1

---

## R315: EventDrivenArchAnalyzerAi

- lag>10000→CRITICAL / >1000→WARNING
- errorRate>5%→CRITICAL
- 컨슈머 미등록→DEGRADED
- throughputUtil>90%→OVERLOADED / <10%→UNDERUTILIZED

---

## R316: PublicInputValidatorAi

- REQUIRED 누락→CRITICAL / FORMAT 불일치→HIGH / RANGE 초과→MEDIUM / CUSTOM 길이→MEDIUM
- CRITICAL/HIGH 없으면 isValid=true

---

## R317: IntelligentServiceGatewayV2

- 차단 클라이언트→DENY
- C/S등급 + payload→BLOCK_DATA_GRADE (N2SF N-05)
- 요청 수 > rateLimit(분당)→THROTTLE
- 정상→ALLOW

---

## R318: CodeTestAutoGeneratorV2

- HAPPY_PATH 항상 생성
- required param → ERROR_CASE
- null/undefined → EDGE_CASE
- number param → BOUNDARY
- throwsOn → 추가 ERROR_CASE
- isAsync → async HAPPY_PATH 추가
- coverageEstimate = min(60 + tests×5, 95)

---

## R319: SecurityVulnPriorityClassifier

- score = cvssScore×10 + (isExploitedInWild?+20) + (HIGH+15/MED+8) + exploitabilityScore×5
- ≥90→CRITICAL(1일) / ≥70→HIGH(7일) / ≥50→MEDIUM(30일) / ≥30→LOW(90일) / INFORMATIONAL
- 우선순위 내림차순 정렬

---

## R320: PublicServiceComparisonAnalyzer

- 차원별 min-max 정규화 + higherIsBetter 반전
- 가중 평균 compositeScore, percentile 계산
- ≥75th → strengths, ≤25th → weaknesses

---

## R321: FailurePatternLibraryAi

- 증상 부분 문자열 매칭
- matchScore = matchedSymptoms / patternSymptoms × 100
- topMatches 최대 3개, ≥50% → isRecognized
- 미인식 또는 confidence<40% → recommendedEscalation

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 초기 작성 | ai-impl-a |
