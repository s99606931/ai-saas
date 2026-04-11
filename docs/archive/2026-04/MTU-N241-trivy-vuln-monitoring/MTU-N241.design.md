# MTU-N241: Trivy Operator 취약점 스캔 성능 모니터링 — Design

> **문서 ID**: MTU-N241-DESIGN
> **버전**: 1.0.0 | **작성일**: 2026-04-11

---

## Design Anchor

| 항목 | 선택 | 근거 |
|------|------|------|
| 메트릭 소스 | Trivy Operator /metrics + VulnerabilityReport CRD | 기존 ServiceMonitor 활용 |
| 취약점 분류 | Critical/High/Medium/Low/Unknown | CVSS 표준 분류 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Recording Rules | infra/monitoring/trivy-performance-rules.yaml |
| 알림 규칙 | infra/monitoring/trivy-performance-alerts.yaml |
| Grafana 대시보드 | infra/monitoring/dashboards/trivy-vulnerability-scan.json |
| 검증 스크립트 | scripts/verify-trivy-monitoring.sh |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
