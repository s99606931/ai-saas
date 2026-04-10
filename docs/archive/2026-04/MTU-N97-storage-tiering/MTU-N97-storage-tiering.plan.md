# MTU-N97: 스토리지 계층화 (Hot/Warm/Cold) + MinIO ILM -- Plan

> **MTU ID**: MTU-N97
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 스토리지 비용 60~80% 절감, 데이터 수명주기 자동화 |
| 기술 | StorageClass 3단계 분리 + MinIO ILM 정책 + PV 자동 이전 |
| 보안 | N2SF 등급별 데이터 암호화 유지, Cold 티어 무결성 보장 |
| 운영 | ILM 규칙 기반 자동 이전, 수동 개입 불필요 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 감사 로그/메트릭/백업 데이터 증가로 스토리지 비용 관리 필요 |
| WHO | SRE 팀, 플랫폼 운영자 |
| RISK | 데이터 이전 중 유실, Cold 티어 접근 지연 |
| SUCCESS | StorageClass 3개 정의, ILM 규칙 5개+, 자동 이전 검증 |
| SCOPE | MinIO ILM, Kubernetes StorageClass, PV 수명주기 |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N97.1 | StorageClass 3단계 정의 (hot/warm/cold) | YAML 3개 파일 |
| FR-N97.2 | MinIO ILM 수명주기 규칙 정의 | 5개+ 규칙 |
| FR-N97.3 | 데이터 이전 자동화 스크립트 | 크론잡 또는 ILM 트리거 |
| FR-N97.4 | 비용 절감 시뮬레이션 대시보드 설정 | Grafana 패널 포함 |
| FR-N97.5 | E2E 테스트 작성 | 8건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
