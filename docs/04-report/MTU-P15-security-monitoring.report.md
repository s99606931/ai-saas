# MTU-P15: 보안 모니터링 — 완료 보고서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-P15 |
| 완료일 | 2026-04-05 |
| 매치율 | 100% (4/4 FR) |
| CSAP 매핑 | D-06, D-10 |

## 산출물

| 파일 | 역할 |
|------|------|
| `platform/services/security-monitor-service/src/handlers/security.handler.ts` | 보안 모니터링 핸들러 6종 |
| `platform/services/security-monitor-service/src/lib/audit.ts` | P13 HTTP 연동 감사 로깅 |
| `platform/services/security-monitor-service/src/routes.ts` | 라우트 6종 |
| `platform/services/security-monitor-service/src/index.ts` | 서비스 진입점 |

## FR 달성

| FR ID | 상태 | 구현 |
|-------|------|------|
| FR-P15.1 | PASS | 로그인 실패 패턴 탐지 — 임계값 5회/5분, 자동 알림 |
| FR-P15.2 | PASS | 이상 접근 패턴 탐지 — 4개 규칙 (다중IP, 비정상시간, 대량요청, 권한상승) |
| FR-P15.3 | PASS | IP 차단 목록 — CRUD 3종 API, 감사 로그 연동 |
| FR-P15.4 | PASS | 보안 이벤트 알림 — severity 필터, 50건 제한 |
