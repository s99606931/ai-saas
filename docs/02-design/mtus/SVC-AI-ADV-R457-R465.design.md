# SVC-AI-ADV R457~R465 Design — AI 고도화 서비스 (트랙 B 11차)

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: ai-impl-b

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 9개 도메인 AI 분석 컴포넌트: 스토리지 최적화, 리스크 분석, 보안 등급, 업무 최적화, 이상 거래, 비용 예측, 데이터 품질, 테넌트 격리, EDA 분석 |
| 기술 | TypeScript class 패턴, Map 기반 인메모리 스토어, append-only 감사 로그 |
| 운영 | N2SF C/S 등급 차단 (registerObject/registerProfile/registerDataset), getAuditLog() 불변 복사본 반환 |
| 규제 | CSAP D-06(감사 로그), D-08(접근 통제), D-12(입력 검증), N2SF N-05(데이터 등급 분류) |

---

## §R457 DataLakeOptimizerV2

- **N2SF 차단**: `registerObject()` 에서 grade C/S → `BLOCKED` 예외
- **티어 이동 규칙**: HOT→COLD(lastAccess>90일 OR freq<1/월), HOT→WARM(>30일 OR freq<5), COMPRESS(>1GB+미압축), WARM→ARCHIVE(>180일), WARM→COLD(>90일), COLD→ARCHIVE(>365일)
- **비용 계산**: HOT=30원/GB/월, WARM=15, COLD=5, ARCHIVE=1

## §R458 RiskScenarioAnalyzerAI

- **점수 산출**: `factorScore = probability × impact × 100`; `overall = max×0.6 + avg×0.4`
- **위험 레벨**: CRITICAL≥70, HIGH≥50, MEDIUM≥30, LOW
- **결과**: CATASTROPHIC/SERIOUS/MANAGEABLE/ACCEPTABLE; 카테고리별 완화 전략

## §R459 ServiceSecurityGraderV2

- **통제 가중치**: AUTH=20, ENCRYPTION=20, INPUT_VALIDATION=15, ACCESS_CONTROL=15, AUDIT_LOG=10, NETWORK=10, PATCH_MANAGEMENT=10
- **강도 점수**: NONE=0, WEAK=0.3, ADEQUATE=0.7, STRONG=1.0
- **패널티**: 알려진 취약점 -20점; 침투테스트 >365일 → recommendations 추가
- **등급**: A≥90, B≥75, C≥60, D≥40, F

## §R460 WorkflowOptimizerV2

- **AUTOMATE**: MANUAL 단계, errorRate<0.1, 비병목 → saving=avgDuration×0.7
- **PARALLELIZE**: 병목 APPROVAL → saving=avgDuration×0.5
- **REORDER**: 기타 병목 → saving=avgDuration×0.3
- **ELIMINATE**: 비병목 errorRate≥0.1 → saving=avgDuration×errorRate×60

## §R461 RealtimeTransactionAnomalyV2

- **탐지 유형**: LARGE_AMOUNT(≥500만원, +25), RAPID_SUCCESSION(60초 내 3건+, +30), UNUSUAL_LOCATION(1h 내 3지역+, CRITICAL, +40), ROUND_TRIP(역방향 유사금액 24h 내, +20), OFF_HOURS(UTC 19~02시, +10)
- **차단 조건**: CRITICAL 이상 존재 OR riskScore≥70
- **검토 조건**: !blocked && riskScore≥30

## §R462 InfraCostPredictorV2

- **키**: `${serviceId}:${resourceType}` (월별 정렬)
- **추세**: trendPercent=(latest-prev)/prev×100; INCREASING>5%, DECREASING<-5%
- **이상**: |trendPercent|>50% → anomalyDetected=true
- **신뢰도**: confidence=0.5+count×0.05 (최대 0.95)

## §R463 PublicDataQualityIndexV2

- **N2SF 차단**: registerProfile에서 grade C/S → `BLOCKED`
- **차원 가중치**: COMPLETENESS=0.3, ACCURACY=0.25, CONSISTENCY=0.2, TIMELINESS=0.15, UNIQUENESS=0.1
- **적시성**: ≤30일=100, ≤90일=70, ≤180일=40, 초과=10
- **등급**: A≥90, B≥75, C≥60, D≥40, F

## §R464 MultitenantIsolationVerifierV3

- **RESOURCE_SHARING**: isShared=true + allowedTenants.length=0 → severity: DATA=CRITICAL, 기타=HIGH
- **DATA_LEAK**: 타 테넌트 isShared=true + allowedTenants.length=0 → 잠재 접근
- **준수 점수**: 100 - (위반수/리소스수)×100 (0~100)
- **상태**: CRITICAL/HIGH 존재→VIOLATED, 기타→WARNING, 없음→COMPLIANT
- **분리 로그**: violationLog(보안), auditLog(일반) 별도 관리

## §R465 EventDrivenArchAnalyzerV2

- **ORPHAN_PRODUCER**: consumers.length=0 && producers.length>0 → HIGH
- **MISSING_CONSUMER**: producers.length=0 && consumers.length>0 → MEDIUM
- **OVERLOADED_TOPIC**: MPS≥1000 → HIGH
- **HIGH_LAG**: avgLagMessages≥5000 → CRITICAL
- **EVENT_LOOP**: A→B→A 순환 탐지 → CRITICAL
- **상태**: CRITICAL 존재→CRITICAL, HIGH→DEGRADED, 없음→HEALTHY

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
