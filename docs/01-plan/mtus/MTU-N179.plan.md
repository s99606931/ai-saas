# MTU-N179: 네트워크 품질 모니터링 Plan

> **문서 ID**: PLAN-N179 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary (4관점 테이블)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 네트워크 장애 사전 감지로 SLA 99.9% 유지, 공공기관 서비스 안정성 확보 |
| 기술 | TCP 재전송률, 대역폭 사용률, 패킷 손실률 실시간 모니터링 체계 구축 |
| 보안 | N2SF 네트워크 격리 영역별 트래픽 이상 탐지, CSAP D-13 네트워크 보안 준수 |
| 운영 | 네트워크 품질 저하 자동 알림, 장애 원인 분석 시간 50% 단축 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 네트워크 품질 문제는 서비스 장애의 주요 원인이나 현재 TCP/IP 계층 모니터링 부재 |
| WHO | SRE팀, 네트워크 관리자, 인프라 운영팀 |
| RISK | 네트워크 장애 미감지 시 서비스 중단, SLA 위반, 공공기관 민원 발생 |
| SUCCESS | TCP 재전송률 <0.1%, 패킷 손실률 <0.01%, 대역폭 사용률 알림 임계치 80% |
| SCOPE | k3s 클러스터 내부/외부 네트워크 품질 메트릭 수집 및 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N179.1 | TCP 재전송률 모니터링 PrometheusRule 구성 | 필수 | D-13 |
| FR-N179.2 | 대역폭 사용률 recording rule 및 알림 구성 | 필수 | D-13 |
| FR-N179.3 | 패킷 손실률 모니터링 및 임계치 알림 | 필수 | D-13 |
| FR-N179.4 | 네트워크 품질 종합 대시보드 (Grafana) | 필수 | D-06 |
| FR-N179.5 | N2SF 등급별 네트워크 영역 분리 모니터링 | 권장 | N-03 |
| FR-N179.6 | 네트워크 지연(RTT) 모니터링 recording rule | 권장 | D-13 |

## 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-N179.1 | 메트릭 수집 주기 15초 이내 | node_exporter + kube-state-metrics 활용 |
| NFR-N179.2 | 알림 발송 지연 1분 이내 | Alertmanager 라우팅 최적화 |
| NFR-N179.3 | 대시보드 로딩 3초 이내 | recording rule 사전 집계 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| PrometheusRule | `infra/monitoring/network-quality-rules.yaml` | YAML |
| Grafana 대시보드 | `infra/monitoring/dashboards/network-quality.json` | JSON |
| 검증 스크립트 | `tests/monitoring/test-network-quality.sh` | Shell |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N179.1 | DS-N179.1 | network-quality-rules.yaml | TC-N179.1 | D-13 |
| FR-N179.2 | DS-N179.2 | network-quality-rules.yaml | TC-N179.2 | D-13 |
| FR-N179.3 | DS-N179.3 | network-quality-rules.yaml | TC-N179.3 | D-13 |
| FR-N179.4 | DS-N179.4 | network-quality.json | TC-N179.4 | D-06 |
| FR-N179.5 | DS-N179.5 | network-quality-rules.yaml | TC-N179.5 | N-03 |
| FR-N179.6 | DS-N179.6 | network-quality-rules.yaml | TC-N179.6 | D-13 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
