# 5장 모니터링 — 분산 추적 (Tracing)

> **대상**: 신규 합류 개발자, DevOps 엔지니어
> **버전**: 1.0.0 | **작성일**: 2026-04-12
> **CSAP**: D-06 (침해사고 관리), D-10 (네트워크 보안)

---

## 이 섹션을 배우면

마이크로서비스 환경에서 하나의 요청이 여러 서비스를 거치는 전체 여정을 시각화하고, 어느 서비스에서 병목이 발생했는지를 추적(Trace)으로 찾아낼 수 있게 됩니다.

---

## 학습 목차

| 파일 | 주제 | 대상 | 예상 학습 시간 |
|------|------|------|--------------|
| [01-tempo-otel.md](01-tempo-otel.md) | Grafana Tempo + OpenTelemetry 분산 추적 | 개발자, DevOps | 60분 |

---

## 핵심 도구

| 도구 | 역할 | 접근 방법 |
|------|------|---------|
| OpenTelemetry SDK | 서비스 코드에서 Span 생성 | `@public-saas/observability` 패키지 |
| OTel Collector | Span 수집 및 Tempo 전달 | `monitoring` 네임스페이스 |
| Grafana Tempo | 추적 데이터 저장소 | Grafana Explore → Tempo |
| Grafana | 추적 시각화 (Waterfall 차트) | `http://localhost:30300` |

---

## 관련 문서

- [5장 모니터링 개요](../README.md)
- [메트릭 — Prometheus 기초](../metrics/01-prometheus-basics.md)
- [로깅 — Loki 가이드](../logging/01-loki-guide.md)
- [9장 트러블슈팅 — 일반 오류](../../09-troubleshooting/01-common-errors.md)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | Implementer (Sonnet) |
