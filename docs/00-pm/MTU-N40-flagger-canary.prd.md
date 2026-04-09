# PRD: MTU-N40 Flagger 카나리 배포 전략

> **버전**: 1.0.0 | **작성일**: 2026-04-09

---

## WHY

현재 배포 전략이 Helm rolling update만 지원하여 배포 실패 시 즉각 롤백이 어렵고, 메트릭 기반 자동 판단이 없다. Flagger를 도입하여 Prometheus 메트릭 기반 카나리 배포를 자동화하고, CSAP D-12(시스템 개발 보안) 배포 안전성을 강화한다.

## SUCCESS

| ID | 기준 |
|----|------|
| SC-N40.1 | Flagger CRD + 컨트롤러 Helm 설치 설정 |
| SC-N40.2 | Canary 리소스 템플릿 (api-gateway 시범) |
| SC-N40.3 | Prometheus 메트릭 기반 자동 롤백 설정 |
| SC-N40.4 | MetricTemplate 정의 (성공률, 지연시간) |
| SC-N40.5 | 운영 가이드 문서 |
