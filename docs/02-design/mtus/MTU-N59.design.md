# MTU-N59: FinOps 비용 최적화 설계 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: qa-strategist

---

## 3.1 비용 분석 구조

```
scripts/finops/
  resource-analysis.sh          # 리소스 사용량 분석
  overprovisioning-check.sh     # 오버프로비저닝 탐지
  idle-resource-detect.sh       # 유휴 리소스 탐지
  weekly-cost-report.sh         # 주간 비용 리포트
  optimization-runbook.md       # 최적화 권고 Runbook
infra/monitoring/dashboards/
  finops-dashboard.json         # Grafana 비용 대시보드
infra/monitoring/
  finops-alerting-rules.yaml    # 비용 알림 규칙
```

## 3.2 비용 메트릭 설계

- `namespace:cpu_request:sum` - 네임스페이스별 CPU 요청 합계
- `namespace:memory_request:sum` - 네임스페이스별 메모리 요청 합계
- `namespace:cpu_utilization:ratio` - CPU 실제 사용률 대비 요청
- `namespace:memory_utilization:ratio` - 메모리 실제 사용률 대비 요청
- 오버프로비저닝: utilization < 20% 이면 권고 대상

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | qa-strategist |
