# SVC-AI-ADV R268~R276 Design — 트랙 A 8차

> **Plan 참조**: `docs/01-plan/mtus/SVC-AI-ADV-R8.plan.md`
> **작성일**: 2026-04-13
> **작성자**: ai-impl-a
> **버전**: 1.0.0

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고급 서비스 8차 설계 |
| WHO | AI 서비스 개발팀 |
| RISK | N2SF 데이터 등급 미검사, 감사 로그 누락 |
| SUCCESS | 설계 기반 구현으로 CSAP D-06/D-08/D-09/D-12 준수 |
| SCOPE | R268~R276 9개 모듈 설계 |

---

## R268: ServiceDependencyDocumenterAi

### 인터페이스

```typescript
interface ServiceNode { serviceId: string; name: string; criticality: 'HIGH' | 'MEDIUM' | 'LOW' }
interface ServiceDependency { fromServiceId: string; toServiceId: string; dependencyType: 'SYNC' | 'ASYNC' | 'DB' | 'CACHE' }
interface DependencyAnalysis { serviceId: string; outboundCount: number; inboundCount: number; criticalPathCount: number; healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'; recommendations: string[] }
```

### 로직

- `registerService()`: 서비스 노드 등록, 감사 로그 `service.register`
- `registerDependency()`: 의존성 등록, 감사 로그 `dependency.register`
- `analyze()`: criticalPathCount > 3 → DEGRADED, HIGH criticality 서비스 → 특별 권고

---

## R269: CloudNativeSecurityScanner

### 인터페이스

```typescript
interface WorkloadConfig { workloadId: string; name: string; privileged?: boolean; runAsRoot?: boolean; hostNetwork?: boolean; secretInEnv?: boolean; resourceLimits?: boolean; readonlyRootFs?: boolean; securityContext?: boolean }
interface SecurityViolation { rule: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'; description: string }
interface SecurityScanResult { workloadId: string; riskScore: number; violations: SecurityViolation[]; overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }
```

### 위반 규칙 (가중치)

| 규칙 | 심각도 | 점수 |
|------|--------|------|
| PRIVILEGED_CONTAINER | CRITICAL | 30 |
| ROOT_USER | CRITICAL | 25 |
| HOST_NETWORK | HIGH | 20 |
| SECRET_IN_ENV | HIGH | 20 |
| NO_RESOURCE_LIMITS | MEDIUM | 15 |
| NO_READONLY_FS | MEDIUM | 10 |
| MISSING_SECURITY_CONTEXT | LOW | 5 |

- riskScore 합산: ≥50→CRITICAL / ≥30→HIGH / ≥15→MEDIUM / else LOW

---

## R270: SaasOnboardingOptimizerAi

### 온보딩 단계

| 단계 | 예상 일수 | 진행률 |
|------|----------|--------|
| SIGNUP | 1 | 20% |
| PROFILE_SETUP | 3 | 40% |
| INTEGRATION | 10 | 60% |
| TRAINING | 5 | 80% |
| GO_LIVE | 2 | 100% |

### 위험 판단

- STUCK 단계 2개 이상 → HIGH
- STUCK 단계 1개 → MEDIUM
- 지연(daysSpent > expectedDays × 2) → 권고사항 추가

---

## R271: IntelligentFaultIsolatorAi

### 장애 유형별 조치

| 조건 | 조치 |
|------|------|
| severity=CRITICAL | ISOLATE (자동) |
| type=MEMORY_LEAK + memUsage>90% | RESTART |
| type=CPU_SPIKE + cpuUsage>85% | SCALE_OUT |
| errorRate>50% | ISOLATE |
| errorRate 20~50% | THROTTLE |
| 기타 | MONITOR |

---

## R272: OrgChartAnalyzerAi

### 분석 지표

- `spanOfControl`: 직접 보고자 수 (>7 → isOverspanned)
- `hierarchyDepth`: 루트에서의 계층 깊이
- `budgetShare`: 전체 예산 대비 비중 (%)
- 루트 노드: `reportsTo` 없음

---

## R273: RealtimeApiContractValidator

### 위반 유형

| 위반 | 심각도 |
|------|--------|
| MISSING_FIELD (required) | CRITICAL |
| TYPE_MISMATCH | HIGH |
| DEPRECATED_FIELD | MEDIUM |
| SCHEMA_CHANGED (unknown field) | LOW |

- CRITICAL 위반 존재 시 `breakingChangeDetected = true`

---

## R274: ServiceMeshConfiguratorAi

### 정책 결정 로직

| 조건 | 정책 |
|------|------|
| namespace=public | MTLS_PERMISSIVE |
| 기타 | MTLS_STRICT |
| rps > 1000 | CONSISTENT_HASH |
| avgLatency > 300ms | LEAST_CONN |
| 기타 | ROUND_ROBIN |
| errorRate > 10% | AGGRESSIVE (5회) |
| errorRate > 5% | MODERATE (3회) |
| errorRate > 1% | CONSERVATIVE (1회) |
| 기타 | NONE |
| timeoutMs = avgLatencyMs × 3 |

---

## R275: DataLakeManagerAi

### 티어 결정

| 조건 | 티어 | 절감율 |
|------|------|--------|
| lastAccessedDaysAgo ≥ 90 | ARCHIVE | 70% |
| lastAccessedDaysAgo ≥ 30 | COLD | 40% |
| 기타 | HOT | 0% |

- N2SF C/S 등급 존 등록 차단 (`BLOCKED` 예외)
- 용량 90% 초과 → CRITICAL 알림

---

## R276: PrivacyComplianceAutomatorAi

### PII 카테고리별 요건

| 카테고리 | 암호화 필수 | 마스킹 필수 |
|---------|-----------|-----------|
| SSN | Y | Y |
| BANK_ACCOUNT | Y | Y |
| PHONE | N | Y |
| NAME | N | N |
| EMAIL | N | N |

- retentionDays > 1825 (5년) → EXCESSIVE_RETENTION
- 동의 미획득 + 법적 근거 없음 → 등록 거부

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 초기 작성 | ai-impl-a |
