# PRD: MTU-N25 모니터링 대시보드 실전 구성

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## WHY

kube-prometheus-stack이 설치되어 Prometheus/Grafana가 동작 중이나, k3s 전용 대시보드가 없고
기본 대시보드만 존재한다. 공공기관 SaaS 운영에 필요한 실전 대시보드(클러스터 현황, 서비스 상태,
GitOps 현황)를 구성하여 감리 증적(D-06) 및 운영 가시성을 확보해야 한다.

## WHO

- 운영팀: 클러스터 및 서비스 상태 실시간 모니터링
- 보안 담당자: 이상 징후 탐지
- 감리관: 모니터링 체계 증적 확인

## SUCCESS

1. k3s 클러스터 개요 대시보드 ConfigMap 적용 + Grafana에서 표시
2. 서비스 상태 대시보드 ConfigMap 적용 + Grafana에서 표시
3. Flux GitOps 현황 대시보드 ConfigMap 적용 + Grafana에서 표시
4. Prometheus 알림 규칙 최소 5개 활성화 확인
5. 모니터링 운영 가이드 문서 작성

## SCOPE

- IN: Grafana 대시보드 ConfigMap 3종, 알림 규칙, 운영 가이드
- OUT: APM(Application Performance Monitoring), 로그 수집(Loki)
