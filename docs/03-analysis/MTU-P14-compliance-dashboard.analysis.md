# MTU-P14: 준수 현황 대시보드 — Q-Gate 분석

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-P14 |
| 분석일 | 2026-04-05 |

## FR 매치율

| FR ID | 요구사항 | 상태 | 검증 |
|-------|---------|------|------|
| FR-P14.1 | CSAP 79항목 준수율 조회 | PASS | GET /compliance/csap — 12개 분야 집계 |
| FR-P14.2 | N2SF 6영역 현황 조회 | PASS | GET /compliance/n2sf — 6영역 상세 |
| FR-P14.3 | 감리 준비도 점수 계산 | PASS | GET /compliance/readiness — 가중평균 |
| FR-P14.4 | OpenTelemetry 메트릭 수집 | PASS | GET /compliance/metrics |

**매치율: 100% (4/4 PASS)**

## 추가 구현

- audit-sdk → MTU-P13 HTTP POST 전송 연동 완료
