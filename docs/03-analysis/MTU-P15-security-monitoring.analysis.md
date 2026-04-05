# MTU-P15: 보안 모니터링 — Q-Gate 분석

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-P15 |
| 분석일 | 2026-04-05 |

## FR 매치율

| FR ID | 요구사항 | 상태 | 검증 |
|-------|---------|------|------|
| FR-P15.1 | 로그인 실패 패턴 탐지 | PASS | GET /security/login-failures — 임계값 5회/5분 |
| FR-P15.2 | 이상 접근 패턴 탐지 | PASS | GET /security/anomalies — 4개 규칙 |
| FR-P15.3 | IP 차단 목록 관리 | PASS | GET/POST/DELETE /security/ip-blocklist |
| FR-P15.4 | 보안 이벤트 알림 | PASS | GET /security/alerts — severity 필터 |

**매치율: 100% (4/4 PASS)**
