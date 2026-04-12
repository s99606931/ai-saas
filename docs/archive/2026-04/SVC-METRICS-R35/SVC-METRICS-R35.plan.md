# SVC-METRICS-R35 Plan: Metrics Collector

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## WHY
애플리케이션 메트릭(카운터/게이지/히스토그램)을 Prometheus 호환 형식으로 수집·노출.

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-MT.1 | Counter 메트릭 (증가만 가능) | P0 |
| FR-MT.2 | Gauge 메트릭 (증감 가능) | P0 |
| FR-MT.3 | Histogram 메트릭 (버킷 분포) | P0 |
| FR-MT.4 | 라벨(tag) 기반 차원 분리 | P0 |
| FR-MT.5 | Prometheus 텍스트 포맷 내보내기 | P0 |
| FR-MT.6 | 레지스트리(registry) 통합 관리 | P1 |

## CSAP/N2SF
- CSAP D-14: 가용성 모니터링 지표 제공
- D-06: 시스템 상태 감사 로그 연계
