# SVC-AI-ADV-R223~R231 Design: AI기반 플랫폼 운영 자동화 (트랙 B 7차)

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | 코드 리뷰, 민원 처리, 서비스 진단, 보안 정책, 거버넌스, 알림, API 분석, 성능 프로파일링, 데이터 카탈로그 9개 AI 자동화 모듈 |
| 보안 | N2SF C/S 차단, CSAP D-06 감사 로그, D-08 접근 통제, D-12 입력 검증 |
| 품질 | TypeScript strict, ESLint 0 오류, 57개 단위 테스트 통과 |
| 운영 | append-only 감사 로그, 복사본 반환으로 무결성 보장 |

## §R223: CodeReviewWorkflowAI

### 설계 결정
- approvalScore = max(0, 100 - Σ(CRITICAL×30 + HIGH×15 + MEDIUM×7 + LOW×2))
- CRITICAL findings 존재 → REJECTED; HIGH findings 존재 → CHANGES_REQUESTED; score≥80 → APPROVED
- 대형 PR(>500줄) 및 민감 파일(.env, secrets, credentials) 자동 플래그

### 클래스 구조
```
CodeReviewWorkflowAI
  review(pr: PullRequest): ReviewResult
  getAuditLog(): AuditEntry[]
```

## §R224: CitizenRequestAutoProcessor

### 설계 결정
- N2SF C/S 등급 → throw 'BLOCKED: {grade}등급...'
- AUTO_RESOLVABLE: DOCUMENT_REQUEST, INQUIRY → 즉시 처리
- 에스컬레이션 키워드(부패/비리/불법/고발/소송/언론) → 민원감사팀 배정
- 나머지 → 담당부서 배정

### 클래스 구조
```
CitizenRequestAutoProcessor
  process(req: CitizenRequest): ProcessingResult
  getAuditLog(): AuditEntry[]
```

## §R225: ServiceHealthDiagnosticianAI

### 설계 결정
- 건강 점수 감점: CPU≥90(-25), Memory≥90(-25), errorRate≥5(-30), latency≥2000(-20)
- 분류: HEALTHY(≥80), DEGRADED(≥50), CRITICAL(≥20), DOWN(<20)
- 히스토리 기반 트렌드: latest vs previous 비교

### 클래스 구조
```
ServiceHealthDiagnosticianAI
  registerService(svc): void
  ingestMetrics(metrics): void
  diagnose(serviceId): DiagnosticReport
  getAuditLog(): AuditEntry[]
```

## §R226: SecurityPolicyEnforcerAI

### 설계 결정
- 정책 유형: IP_BLOCKED(IP 목록 검사), ROLE_REQUIRED(역할 검사), RATE_LIMIT(호출 횟수 검사)
- INACTIVE 정책 건너뜀; priority 오름차순 평가
- 결과: BLOCKED > WARNED > ALLOWED 우선순위

### 클래스 구조
```
SecurityPolicyEnforcerAI
  addPolicy(policy): void
  evaluate(req: PolicyRequest): EnforcementResult
  getAuditLog(): AuditEntry[]
```

## §R227: DataGovernanceAutomatorAI

### 설계 결정
- PII + PUBLIC 분류 → 개인정보보호법 위반 (violation)
- 보존 만료 grace period: 만료 후 2년 초과 → violation; 2년 이내 → recommendation
- 미접근 365일+ → recommendation

### 클래스 구조
```
DataGovernanceAutomatorAI
  registerAsset(asset): void
  assess(assetId): GovernanceAssessment
  getAuditLog(): AuditEntry[]
```

## §R228: MultitenantNotificationOptimizer

### 설계 결정
- URGENT: 한도/quiet hours 우회, 채널=EMAIL+SMS+PUSH, estimatedDeliveryMs=100
- HIGH: estimatedDeliveryMs=1000, 일반: 5000
- 한도 초과 non-URGENT → deferred=true, deferReason 포함 '한도'

### 클래스 구조
```
MultitenantNotificationOptimizer
  registerTenant(tenant): void
  optimize(notification): NotificationPlan
  getAuditLog(): AuditEntry[]
```

## §R229: ApiUsagePatternAnalyzerV2

### 설계 결정
- p95: index = floor(n*0.95)
- 트렌드: secondHalf > firstHalf → GROWING; secondHalf < firstHalf → DECLINING
- 이상 탐지: callCount > minCount × thresholdMultiplier (기본 3)

### 클래스 구조
```
ApiUsagePatternAnalyzerV2
  ingest(record): void
  analyze(apiId): UsagePattern
  detectAnomalies(apiId, threshold?): AnomalyReport
  getAuditLog(): AuditEntry[]
```

## §R230: AutoPerformanceProfilerAI

### 설계 결정
- avgCpu≥80 → CPU_BOUND; avgMemory≥512 → MEMORY_BOUND; avgMs≥1000 → IO_BOUND; 아니면 NONE
- p99: index = floor(n*0.99)
- p99 > avg×5 → 추가 최적화 제안

### 클래스 구조
```
AutoPerformanceProfilerAI
  registerTarget(target): void
  addSample(sample): void
  profile(targetId): PerformanceReport
  getAuditLog(): AuditEntry[]
```

## §R231: PublicDataCatalogAI

### 설계 결정
- N2SF C/S 등급 → throw 'BLOCKED: ...'
- 카테고리 추론: 교통/환경/복지/행정/경제/기타 (tags + name 키워드 매칭)
- qualityScore: base 60 + description≥50(+10) + tags≥3(+10) + fields≥5(+10) + DAILY/REALTIME(+10)
- openDataEligible: grade=O && qualityScore≥60

### 클래스 구조
```
PublicDataCatalogAI
  catalog_dataset(dataset): CatalogEntry
  search(query): CatalogEntry[]
  getAuditLog(): AuditEntry[]
```

## 추적성 매트릭스
| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R223.1~4 | code-review-workflow-ai.ts | code-review-workflow-ai.test.ts | D-06,D-12 |
| FR-R224.1~4 | citizen-request-auto-processor.ts | citizen-request-auto-processor.test.ts | D-06,N2SF |
| FR-R225.1~4 | service-health-diagnostician-ai.ts | service-health-diagnostician-ai.test.ts | D-06 |
| FR-R226.1~4 | security-policy-enforcer-ai.ts | security-policy-enforcer-ai.test.ts | D-06,D-08 |
| FR-R227.1~4 | data-governance-automator-ai.ts | data-governance-automator-ai.test.ts | D-06 |
| FR-R228.1~4 | multitenant-notification-optimizer.ts | multitenant-notification-optimizer.test.ts | D-06 |
| FR-R229.1~4 | api-usage-pattern-analyzer-v2.ts | api-usage-pattern-analyzer-v2.test.ts | D-06 |
| FR-R230.1~4 | auto-performance-profiler-ai.ts | auto-performance-profiler-ai.test.ts | D-06 |
| FR-R231.1~4 | public-data-catalog-ai.ts | public-data-catalog-ai.test.ts | D-06,N2SF |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
