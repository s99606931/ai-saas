# SVC-AI-ADV-R682 Plan — AI기반 위협 인텔리전스 집계 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 다중 출처 IoC(침해지표) 집계 → 단일 위협 점수로 우선순위화 |
| WHO | SOC팀, 보안운영센터 |
| RISK | N2SF C/S 등급 IoC 외부 전송 금지, 분석가 이메일 PII 마스킹 |
| SUCCESS | FR-R682.1~5 모두 충족, ≥5 Vitest 통과 |
| SCOPE | platform/services/ai-service/src/lib/ai-threat-intel-aggregator-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R682.1 | `registerFeed(feed)` 피드 등록 (feedId, name, reliability 0~1) |
| FR-R682.2 | `ingest(indicator, grade?)` IoC 수집, C/S→BLOCKED, analystEmail→SHA-256 16자 마스킹 |
| FR-R682.3 | 집계 점수 = severity × feed.reliability (여러 피드 동일 IoC → max 채택) |
| FR-R682.4 | 등급: ≥0.8 CRITICAL / ≥0.5 HIGH / ≥0.3 MEDIUM / LOW |
| FR-R682.5 | `getAuditLog()` append-only 감사 로그 (REGISTER_FEED/INGEST) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
