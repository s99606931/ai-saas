# SVC-AI-ADV R394~R402 Design — AI 고도화 서비스 (트랙 B 9차)

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: ai-impl-b

---

## §R394 — IntelligentLogAggregatorAI

**파일**: `platform/services/ai-service/src/lib/intelligent-log-aggregator-ai.ts`

- `ingest(entry)`: N2SF C/S 등급 차단 → `this.logs` Map에 저장
- `aggregate(serviceId)`: 패턴 키 = 메시지 첫 5단어; 에러율 ≥ 0.2 || FATAL > 0 → anomalyDetected; 상위 5개 패턴 반환
- `getAuditLog()`: `[...this.auditLog]` 복사본 반환

---

## §R395 — PublicTaskRiskAssessorAI

**파일**: `platform/services/ai-service/src/lib/public-task-risk-assessor-ai.ts`

- `registerTask(task)`: N2SF C/S 등급 차단 → tasks Map 저장
- `assess(taskId)`: 위험 요인별 점수 누산 — 마감 초과(+30)/촉박(+20), 예산 5억+(+20), 이해관계자 10명+(+15), PII(+20), 외부 연계(+15)
- 위험 등급: CRITICAL≥70, HIGH≥40, MEDIUM≥20, LOW

---

## §R396 — AutoSLAReportGeneratorAI

**파일**: `platform/services/ai-service/src/lib/auto-sla-report-generator-ai.ts`

- `ingestMetric(metric)`: 키 = `serviceId:period` 로 저장
- `generateReport(serviceId, period)`: 점수 100에서 차감 — 가용성 <99.9%(−10/25/40), 응답 >200ms(−5/15/30), 에러율 >0.1%(−5/20/35), MTTR >60분(−10)
- 등급: A≥95, B≥85, C≥70, D≥55, F
- 추세: `currScore > prevScore*1.02` → IMPROVED, `< *0.98` → DEGRADED

---

## §R397 — RealtimeApiThreatDetector

**파일**: `platform/services/ai-service/src/lib/realtime-api-threat-detector.ts`

- `detect(request)`: SQL/XSS/경로 순회 정규식 탐지, 60초 내 401 5회+ → BRUTE_FORCE, 60초 내 100회+ → RATE_ABUSE
- CRITICAL 위협 또는 riskScore≥60 → `blocked=true`
- 이력: `clientIp` 기준 슬라이딩 윈도우

---

## §R398 — SmartResourceReservationAI

**파일**: `platform/services/ai-service/src/lib/smart-resource-reservation-ai.ts`

- `reserve(request)`: 종료≤시작 → REJECTED; 타입/용량/태그/시간 충돌 검사; 최소 초과 용량 선택 (best-fit)
- 대기열: URGENT → position 1, 기타 → waitlist.length + 1
- `cancel(requestId, userId)`: userId 기준 예약 제거

---

## §R399 — PublicLanguageCorrectorV2

**파일**: `platform/services/ai-service/src/lib/public-language-corrector-v2.ts`

- `correct(input)`: N2SF C/S 등급 차단; JARGON_MAP(8개 항목) → 쉬운 우리말; INFORMAL_MAP(8개 항목) → 공식 표현
- 가독성 점수: `100 − (avgSentenceLength − 20) × 1.5` 클램핑 0~100
- 격식 점수: 공식 종결어미(습니다/입니다/합니다/됩니다) 비율 × 100

---

## §R400 — MultitenantBehaviorAnalyzerAI

**파일**: `platform/services/ai-service/src/lib/multitenant-behavior-analyzer-ai.ts`

- `analyze(tenantId)`: BULK_EXPORT(resourceCount≥1000, +30), OFF_HOURS_ACCESS(UTC 20~02시 3건+, +15), CROSS_TENANT_PROBE(CRITICAL, +40), UNUSUAL_VOLUME(1시간 내 1000건+, +25)
- `riskScore = min(100, 누산)`, CRITICAL 포함 또는 riskScore≥60 → `blocked=true`

---

## §R401 — CicdOptimizerV2

**파일**: `platform/services/ai-service/src/lib/cicd-optimizer-v2.ts`

- `optimize(pipelineId)`: 최신 실행 분석 — 병렬화 가능(비캐시) 2개+ → PARALLELIZE; 비캐시 BUILD/TEST → CACHE_ENABLE; 병목(전체 40%+) → INCREASE_RESOURCES
- `estimatedTotalSavingMs`: 제안 절감 시간 합산

---

## §R402 — ServiceDependencyDocumenterV2

**파일**: `platform/services/ai-service/src/lib/service-dependency-documenter-v2.ts`

- `addDependency(edge)`: 양쪽 서비스 등록 여부 검사
- `document(serviceId, format)`: MARKDOWN(테이블), MERMAID(graph LR), JSON(구조화) 형식
- 크리티컬 의존성: `critical=true` 아웃바운드 서비스명 목록

---

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 파일 | CSAP 항목 |
|-------|----------|------------|----------|
| SVC-AI-ADV-R394 | intelligent-log-aggregator-ai.ts | ...test.ts | D-06, N2SF |
| SVC-AI-ADV-R395 | public-task-risk-assessor-ai.ts | ...test.ts | D-06, N2SF |
| SVC-AI-ADV-R396 | auto-sla-report-generator-ai.ts | ...test.ts | D-06 |
| SVC-AI-ADV-R397 | realtime-api-threat-detector.ts | ...test.ts | D-06, D-08, D-12 |
| SVC-AI-ADV-R398 | smart-resource-reservation-ai.ts | ...test.ts | D-06, D-08 |
| SVC-AI-ADV-R399 | public-language-corrector-v2.ts | ...test.ts | D-06, N2SF |
| SVC-AI-ADV-R400 | multitenant-behavior-analyzer-ai.ts | ...test.ts | D-06, D-08 |
| SVC-AI-ADV-R401 | cicd-optimizer-v2.ts | ...test.ts | D-06 |
| SVC-AI-ADV-R402 | service-dependency-documenter-v2.ts | ...test.ts | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
