# MTU-N213: Service Account 토큰 만료 모니터링 -- Plan
> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
## 기능 요구사항
| ID | 요구사항 | CSAP |
|----|---------|------|
| FR-N213.1 | SA 토큰 만료 임박 recording rule | D-08 |
| FR-N213.2 | 만료 임박 알림 | D-08 |
| FR-N213.3 | 대시보드 + E2E | D-08 |
## 산출물
| # | 경로 |
|---|------|
| 1 | infra/monitoring/sa-token/sa-token-expiry-rules.yaml |
| 2 | infra/monitoring/sa-token/sa-token-expiry-alerts.yaml |
| 3 | infra/monitoring/dashboards/sa-token-expiry-dashboard.json |
| 4 | tests/monitoring/test-mtu-n213-sa-token-expiry.sh |
## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 | PM Lead |
