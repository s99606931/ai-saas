# MTU-N102: Thanos 장기 메트릭 저장소 + Grafana 연합 -- Plan

> **MTU ID**: MTU-N102
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 메트릭 장기 보존 (1년+), 멀티클러스터 연합 쿼리 |
| 기술 | Thanos Sidecar + Store Gateway + MinIO 객체 스토리지 |
| 보안 | 메트릭 데이터 접근 RBAC, TLS 통신 |
| 운영 | 자동 컴팩션, 다운샘플링, 비용 최적화 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CSAP D-06 감사 요건 1년+ 메트릭 보존, 스토리지 최적화 |
| WHO | SRE 팀, 감리 대응팀 |
| RISK | Thanos 학습 곡선, MinIO 스토리지 용량 |
| SUCCESS | Sidecar 연동, Store GW 동작, 1년+ 쿼리 가능 |
| SCOPE | Thanos Sidecar, Store Gateway, Compactor, Query, MinIO |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N102.1 | Thanos Sidecar 설치 | Prometheus 연동 |
| FR-N102.2 | Store Gateway + MinIO 연동 | 객체 스토리지 버킷 |
| FR-N102.3 | Compactor 다운샘플링 설정 | 5m, 1h 해상도 |
| FR-N102.4 | Query Frontend 캐시 설정 | 쿼리 성능 최적화 |
| FR-N102.5 | Grafana 데이터소스 연동 | Thanos Query 엔드포인트 |
| FR-N102.6 | E2E 테스트 작성 | 10건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
