# SVC-AI-ADV-R367~R375 Design: AI기반 플랫폼 운영 자동화 (트랙 B 8차)

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | API 게이트웨이 최적화, 민원 예측, 의존성 모니터링, 데이터 품질, 코드 취약점, 배포 전략, 지식 큐레이션, 서비스 품질, 데이터 격리 9개 AI 자동화 모듈 |
| 보안 | N2SF C/S 차단(R368/R370/R373), CSAP D-06/D-08/D-12, OWASP Top10 취약점 탐지(R371) |
| 품질 | TypeScript strict, ESLint 0 오류, 64개 단위 테스트 통과 |
| 운영 | append-only 감사 로그, 복사본 반환으로 무결성 보장 |

## §R367: ApiGatewayOptimizerAI

### 설계 결정
- 우선순위: CIRCUIT_BREAK(에러율≥30%) > RATE_LIMIT_ADJUST(요청량>90%) > CACHE_ENABLE(레이턴시≥500ms) > ROUTE_REMOVE(DEPRECATED+트래픽0)
- suggestedRateLimit = currentLimit × 1.5 (올림)
- 메트릭 없으면 NONE 반환

## §R368: ComplaintPatternPredictorAI

### 설계 결정
- N2SF C/S 등급 → throw 'BLOCKED: ...'
- 트렌드: secondHalf >= firstHalf && secondHalf > 0 → INCREASING
- 예측 볼륨: 현재량 × (INCREASING:1.2, DECREASING:0.8, STABLE:1.0)
- 계절 피크: 교통(봄/가을), 환경(여름), 복지(겨울), 건설(봄~초여름)

## §R369: ServiceDependencyHealthMonitor

### 설계 결정
- 다운스트림: 이 서비스를 의존하는 모든 서비스 목록
- 크리티컬 패스: 다운스트림 중 CRITICAL/HIGH criticality 서비스 존재 시
- 리스크 계산: DOWN(+40), DEGRADED(+20), errorRate≥20%(+30), latency≥2000ms(+20), criticality CRITICAL(+10), 다운스트림≥3(+10), 크리티컬 패스(+10)

## §R370: DataQualityValidatorAI

### 설계 결정
- N2SF C/S 등급 → throw 'BLOCKED: ...'
- 타입별 검증: NUMBER(NaN 체크), EMAIL(regex), PHONE(regex/WARNING), DATE(Date.parse)
- passedFields: 타입 오류 없고 maxLength 미초과인 필드 수
- qualityScore = passedFields/totalFields × 100

## §R371: CodeVulnerabilityPatternAnalyzer

### 설계 결정
- 7개 패턴: SQL_INJECTION(CRITICAL), XSS(HIGH), HARDCODED_SECRET(CRITICAL), INSECURE_CRYPTO(MEDIUM), PATH_TRAVERSAL(HIGH), COMMAND_INJECTION(CRITICAL), SENSITIVE_LOG(MEDIUM)
- riskScore = Σ(CRITICAL×30+HIGH×20+MEDIUM×10+LOW×5+INFO×1), max 100
- passed: CRITICAL=0 && riskScore<30

## §R372: DeploymentStrategyOptimizerAI

### 설계 결정
- HOTFIX+PRODUCTION → BLUE_GREEN (즉시 교체 가능)
- SCHEMA_MIGRATION → RECREATE (다운타임 허용)
- HIGH/CRITICAL 리스크 → CANARY (점진적 배포)
- PRODUCTION → ROLLING; 기타 → ROLLING
- 롤백 시간: BLUE_GREEN=2min, CANARY=5min, ROLLING=10min, RECREATE=15min

## §R373: PublicKnowledgeCuratorAI

### 설계 결정
- N2SF C/S 등급 → throw 'BLOCKED: ...'
- 품질 점수: base 60 + 50자이상(없음, 200자이상+10) + 제목5자이상(+5) + 태그3개이상(+10)
- 상태 우선순위: APPROVED(≥70&&issues=0) > OUTDATED(미업데이트) > REJECTED(<40) > PENDING_REVIEW
- 태그 키워드: 민원/보안/데이터/행정/법규

## §R374: RealtimeServiceQualityAssurer

### 설계 결정
- AT_RISK 조건: successRate < minSuccessRate + 0.005 (1% 미만 여유)
- 품질 레벨: EXCELLENT(≥90), GOOD(≥75), ACCEPTABLE(≥60), POOR(≥40), UNACCEPTABLE(<40)
- SLA 상태: breach > atRisk > within_sla 우선순위

## §R375: MultitenantDataIsolationVerifierV2

### 설계 결정
- 허용 리소스 목록에 없는 크로스 테넌트 접근 → 위반
- 심각도: DELETE→CRITICAL, WRITE→HIGH(또는 STRICT에서 HIGH), READ→MEDIUM
- CRITICAL/HIGH 위반 시 allowed=false
- 위반 로그는 별도 violationLog에 누적 (감사 로그와 분리)

## 추적성 매트릭스
| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R367.1~5 | api-gateway-optimizer-ai.ts | api-gateway-optimizer-ai.test.ts | D-06 |
| FR-R368.1~5 | complaint-pattern-predictor-ai.ts | complaint-pattern-predictor-ai.test.ts | D-06,N2SF |
| FR-R369.1~5 | service-dependency-health-monitor.ts | service-dependency-health-monitor.test.ts | D-06 |
| FR-R370.1~5 | data-quality-validator-ai.ts | data-quality-validator-ai.test.ts | D-06,D-12,N2SF |
| FR-R371.1~4 | code-vulnerability-pattern-analyzer.ts | code-vulnerability-pattern-analyzer.test.ts | D-06,D-12 |
| FR-R372.1~5 | deployment-strategy-optimizer-ai.ts | deployment-strategy-optimizer-ai.test.ts | D-06 |
| FR-R373.1~5 | public-knowledge-curator-ai.ts | public-knowledge-curator-ai.test.ts | D-06,N2SF |
| FR-R374.1~5 | realtime-service-quality-assurer.ts | realtime-service-quality-assurer.test.ts | D-06 |
| FR-R375.1~5 | multitenant-data-isolation-verifier-v2.ts | multitenant-data-isolation-verifier-v2.test.ts | D-06,D-08 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
