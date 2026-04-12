# SVC-AI-ADV R188~R195 설계서 (트랙 B 6차)

> **요구사항 ID**: SVC-AI-ADV-R188 ~ R195
> **작성일**: 2026-04-12
> **작성자**: Implementer (ai-impl-b)
> **버전**: 1.0.0

---

## §1. R188 — MicroserviceAutodiscoveryAI

### 클래스 설계
```
MicroserviceAutodiscoveryAI
  registry: Map<serviceId, ServiceDescriptor>
  auditLog: AuditEntry[]

  registerService(descriptor): void
  discover(query: DiscoveryQuery): DiscoveryResult
  getRegistry(): ServiceDescriptor[]
  getAuditLog(): AuditEntry[]  // 복사본 반환
```

### 검색 알고리즘
1. healthy=false 제외
2. requiredTags 전부 포함 여부 필터
3. minVersion semver 비교 (숫자 파싱)
4. 인텐트 토큰 → name+tags+endpoints 대상 매칭 count / totalTokens = score
5. score > 0 인 결과만 반환, 내림차순 정렬

---

## §2. R189 — ApiVersionMigrationAI

### 클래스 설계
```
ApiVersionMigrationAI
  versions: Map<versionId, ApiVersion>
  auditLog: AuditEntry[]

  registerVersion(version): void
  generateMigrationPlan(fromId, toId): MigrationPlan
  getAuditLog(): AuditEntry[]
```

### 마이그레이션 스텝 생성
- fromPaths ∖ toPaths → REMOVE 스텝
- toPaths ∖ fromPaths → ADD 스텝
- to에 deprecated=true 엔드포인트 → MODIFY 스텝
- riskLevel: REMOVE ≥5 → HIGH, ≥2 → MEDIUM, else LOW
- estimatedEffortHours: steps.length × 2

---

## §3. R190 — MultimodalPublicSearch

### 클래스 설계
```
MultimodalPublicSearch
  index: Map<docId, PublicServiceDoc>
  auditLog: AuditEntry[]

  indexDocument(doc): void  // C/S 등급 차단
  search(query): SearchResult
  getAuditLog(): AuditEntry[]
```

### N2SF N-05 적용
- `indexDocument()` 진입 시 grade C/S → throw `BLOCKED: {grade}등급 문서는 공개 검색 색인 금지 (N2SF N-05)`
- 검색 결과는 O 등급 문서만 포함됨 (색인 단계에서 차단)

---

## §4. R191 — ModelDriftCorrector

### 드리프트 판정 기준
| maxDrop | severity | action | correctionApplied |
|---------|---------|--------|-------------------|
| ≥ 0.20 | CRITICAL | ROLLBACK | true |
| ≥ 0.10 | HIGH | RETRAIN | true |
| ≥ 0.05 | MEDIUM | ALERT | false |
| > threshold | LOW | ALERT | false |
| ≤ threshold | NONE | NONE | false |

- maxDrop = max(accuracyDrop, precisionDrop, recallDrop)
- 메트릭 0건이면 driftDetected=false, severity=NONE

---

## §5. R192 — PrivilegeEscalationDetector

### 역할 계층 (ROLE_RANK)
```
VIEWER=0, USER=1, OPERATOR=2, ADMIN=3, SUPERADMIN=4
```

### 승급 감지 기준
| levelJump | severity | blocked |
|-----------|---------|---------|
| ≥ 3 | CRITICAL | true |
| = 2 | HIGH | true |
| = 1 | MEDIUM | false |
| ≤ 0 | NONE | false |

### CSAP D-08 준수
- 모든 detect() 호출 감사 로그 기록
- blocked=true 인 이벤트는 자동 차단 플래그 설정

---

## §6. R193 — StreamingAnomalyDetector

### 베이스라인 계산 방법
- 현재 이벤트를 **제외한** 이전 이벤트들로 mean/std 계산
- 최소 2개 이전 이벤트 필요 (미만이면 null 반환)
- std=0 시: currentRate ≠ mean → anomalyThresholdSigma+1 zScore 부여

### 이상 유형 분류
- currentRate=0 → STOP
- zScore > 0 → SPIKE
- zScore < 0 → DROP

---

## §7. R194 — BudgetExecutionAnalyzer

### 패턴 탐지 기준
| 조건 | 패턴 |
|------|------|
| firstHalf/total ≥ 0.7 | FRONT_LOADED |
| firstHalf/total ≤ 0.3 | BACK_LOADED |
| nonZeroMonths ≤ 3 | IRREGULAR |
| else | EVEN |

### Bottleneck 탐지
- 월별 지출 > mean×2 인 월 → bottleneckMonths 목록

### 권고 메시지
- executionRate < 0.5 → 조기 집행 권고
- BACK_LOADED → 균등 집행 권고
- FRONT_LOADED → 하반기 배분 검토
- bottlenecks 있음 → 평준화 집행 권고

---

## §8. R195 — ComplaintPriorityClassifierV2

### 점수 산정
```
score = CHANNEL_SCORE[channel]
      + Σ CRITICAL_TERMS 매칭 × 30
      + Σ HIGH_TERMS 매칭 × 15
      + (isRepeat ? 15 : 0)
      + (daysWaiting ≥ 30 ? 20 : daysWaiting ≥ 14 ? 10 : 0)
```

### 우선순위 결정
| score | priority | responseHours |
|-------|---------|---------------|
| ≥ 60 | CRITICAL | 2 |
| ≥ 35 | HIGH | 24 |
| ≥ 15 | NORMAL | 72 |
| < 15 | LOW | 168 |

### N2SF N-05
- `classify()` 진입 시 grade C/S → throw `BLOCKED`

---

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 파일 | CSAP |
|-------|---------|----------|------|
| FR-AI.188 | microservice-autodiscovery-ai.ts | __tests__/microservice-autodiscovery-ai.test.ts | D-06 |
| FR-AI.189 | api-version-migration-ai.ts | __tests__/api-version-migration-ai.test.ts | D-06 |
| FR-AI.190 | multimodal-public-search.ts | __tests__/multimodal-public-search.test.ts | D-06, N2SF |
| FR-AI.191 | model-drift-corrector.ts | __tests__/model-drift-corrector.test.ts | D-06 |
| FR-AI.192 | privilege-escalation-detector.ts | __tests__/privilege-escalation-detector.test.ts | D-06, D-08 |
| FR-AI.193 | streaming-anomaly-detector.ts | __tests__/streaming-anomaly-detector.test.ts | D-06 |
| FR-AI.194 | budget-execution-analyzer.ts | __tests__/budget-execution-analyzer.test.ts | D-06 |
| FR-AI.195 | complaint-priority-classifier-v2.ts | __tests__/complaint-priority-classifier-v2.test.ts | D-06, N2SF |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 | ai-impl-b |
