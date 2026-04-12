# MTU-N64: CloudNativePG PostgreSQL Operator

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 SaaS 데이터베이스를 Kubernetes 네이티브 운영으로 RTO/RPO 향상 |
| 기술 | CloudNativePG Operator + HA 클러스터 (1 Primary + 2 Replica) + WAL 아카이빙 |
| 보안 | CSAP D-09 DB 암호화, TLS 인증서 자동 (cert-manager 연동), Sealed Secrets 자격 증명 |
| 운영 | 자동 장애 복구, WAL 백업 MinIO 연동, Prometheus 모니터링 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N64.1 | CloudNativePG Operator Helm values.yaml | P0 |
| FR-N64.2 | SaaS 메인 DB 클러스터 (HA 3인스턴스) | P0 |
| FR-N64.3 | WAL 아카이빙 + MinIO 백업 설정 | P0 |
| FR-N64.4 | cert-manager 연동 TLS 인증서 | P1 |
| FR-N64.5 | Prometheus 모니터링 (PodMonitor) | P1 |
| FR-N64.6 | 백업/복구 Runbook | P1 |
| FR-N64.7 | Flux GitOps 배포 연동 | P1 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
