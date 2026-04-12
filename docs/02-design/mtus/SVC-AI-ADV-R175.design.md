# SVC-AI-ADV-R175 Design — AI기반 서비스 의존성 최적화

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 마이크로서비스 순환 의존성 탐지로 장애 전파 방지 |
| WHO | 아키텍처팀 |
| RISK | 순환 의존성 미탐지 → 서비스 전체 장애 |
| SUCCESS | DFS 기반 순환 탐지 + 깊은 체인 경고 |
| SCOPE | 구현 파일: `service-dependency-optimizer.ts` |

## 클래스 설계

### `ServiceDependencyOptimizer`

| 메서드 | 설명 |
|--------|------|
| `addService(serviceId, latencyMs)` | 서비스 등록 |
| `addDependency(from, to, latencyMs)` | 의존성 등록 |
| `detectCycles()` | DFS 기반 순환 탐지 |
| `detectDeepChains(maxDepth)` | 깊이 초과 체인 탐지 |
| `generateRecommendations()` | 권고사항 생성 |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 알고리즘 설계

- DFS + 방문 색상 (WHITE/GRAY/BLACK)으로 순환 탐지
- 재귀 깊이 추적으로 DEEP_CHAIN 탐지
- 지연 임계값(200ms) 초과 시 HIGH_LATENCY 권고

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R175.1 | addService/addDependency | 서비스 등록 | D-12 |
| FR-R175.2 | detectCycles | 순환 탐지 | D-06 |
| FR-R175.3 | detectDeepChains | 깊이 초과 | D-06 |
| FR-R175.4 | generateRecommendations | 권고 생성 | D-06 |
| FR-R175.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
