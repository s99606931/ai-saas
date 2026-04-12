# Plan: MTU-N175 OpenTelemetry Auto-Instrumentation Operator

> 버전: 1.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 코드 수정 없이 전 서비스 분산 추적 자동화 |
| 기술 | OTel Operator + Auto-Instrumentation + 2티어 Collector |
| 보안 | 텔레메트리 데이터 내부 전송 (TLS), PII 마스킹 |
| 운영 | DaemonSet Agent + Gateway Collector, Tempo/Loki 연동 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-OTEL.1 | OTel Operator Helm 배포 | HIGH |
| FR-OTEL.2 | Auto-Instrumentation CRD (Node.js, Python) | HIGH |
| FR-OTEL.3 | 2티어 Collector 아키텍처 (DaemonSet + Gateway) | HIGH |
| FR-OTEL.4 | Tempo 분산 추적 연동 | HIGH |
| FR-OTEL.5 | Loki 로그 연동 (구조화 로그) | MED |
| FR-OTEL.6 | Prometheus 메트릭 연동 | MED |
| FR-OTEL.7 | 환경별 샘플링 설정 (dev 100%, prod 10%) | MED |
| FR-OTEL.8 | PII 마스킹 프로세서 | HIGH |
