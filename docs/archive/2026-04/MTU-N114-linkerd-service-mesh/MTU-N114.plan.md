# MTU-N114: Linkerd 서비스 메시 완성

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 간 mTLS 자동화, 트래픽 분할(카나리/블루그린), 서비스 메시 관측성 확보 |
| 기술 | Linkerd TrafficSplit SMI, ServiceProfile 확장, Grafana 메시 대시보드 |
| 보안 | 자동 mTLS로 제로트러스트 네트워크, CSAP D-09 전송 암호화 완전 충족 |
| 운영 | 서비스 간 통신 가시성, 지연시간 분석, 에러율 자동 추적 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 Linkerd 기본 설치만 완료. TrafficSplit, 서비스별 라우팅 정책, 관측성 대시보드 미구현 |
| WHO | 플랫폼 운영팀, SRE팀 |
| RISK | 메시 프록시 오버헤드(CPU/메모리), 설정 오류 시 서비스 통신 차단 |
| SUCCESS | 전체 서비스 mTLS 적용 확인, TrafficSplit 기반 카나리 배포 동작, 메시 대시보드 완성 |
| SCOPE | TrafficSplit 리소스, RetryBudget 정책, 서비스 메시 대시보드, E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N114.1 | TrafficSplit SMI 리소스로 카나리 배포 구성 | HIGH | D-10 |
| FR-N114.2 | 서비스별 RetryBudget 및 타임아웃 정책 | HIGH | D-10 |
| FR-N114.3 | 서비스 간 인증 정책 (ServerAuthorization) 확장 | HIGH | D-08 |
| FR-N114.4 | mTLS 검증 스크립트 (전 서비스 암호화 확인) | HIGH | D-09 |
| FR-N114.5 | 서비스 메시 Grafana 대시보드 확장 | MED | D-06 |
| FR-N114.6 | E2E 테스트: mTLS 확인 + TrafficSplit 동작 검증 | HIGH | D-12 |

## 추적성 매트릭스

| FR | Design | 구현 파일 | 테스트 | CSAP |
|----|--------|----------|--------|------|
| FR-N114.1 | DS-N114.1 | infra/linkerd/traffic-split/ | T-N114.1 | D-10 |
| FR-N114.2 | DS-N114.2 | infra/linkerd/service-profiles/ | T-N114.2 | D-10 |
| FR-N114.3 | DS-N114.3 | infra/linkerd/authorization/ | T-N114.3 | D-08 |
| FR-N114.4 | DS-N114.4 | scripts/verify-mtls.sh | T-N114.4 | D-09 |
| FR-N114.5 | DS-N114.5 | infra/monitoring/dashboards/linkerd-mesh.json | T-N114.5 | D-06 |
| FR-N114.6 | DS-N114.6 | tests/e2e/linkerd-mesh.test.sh | T-N114.6 | D-12 |
