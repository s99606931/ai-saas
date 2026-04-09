# MTU-N21: WSL DevOps 환경 완전 구축 — 검증 보고서

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **matchRate**: 100% (8/8 FR 충족)

---

## Executive Summary

| 관점 | 계획 | 달성 |
|------|------|------|
| 비즈니스 | WSL2에서 완전한 DevOps 환경 구축 | 5개 서비스 모두 Running 달성 |
| 기술 | k3s + Gitea + Harbor + Flux + Prometheus/Grafana | 전체 스택 기동 성공 |
| 보안 | CSAP D-09, D-10, D-11, D-12 | 시크릿 자동 생성, .env 분리 완료 |
| 운영 | 원클릭 설치 스크립트 | setup-wsl2-all.sh 검증 완료 |

---

## FR별 달성 현황

| FR ID | 요구사항 | 상태 | 검증 결과 |
|-------|---------|------|----------|
| FR-N21.1 | k3s 클러스터 정상 동작 | 달성 | v1.34.6+k3s1, Ready |
| FR-N21.2 | Gitea + PostgreSQL 기동 | 달성 | v1.22.6, HTTP 200, healthy |
| FR-N21.3 | Act Runner 등록 및 실행 | 달성 | v0.3.1, 등록 완료, task 수신 |
| FR-N21.4 | Harbor 설치 및 기동 | 달성 | v2.11.2, 8개 컴포넌트 healthy |
| FR-N21.5 | k3s-Harbor 레지스트리 연동 | 달성 | registries.yaml 설정, Pod Pull 성공 |
| FR-N21.6 | Flux v2 설치 | 달성 | v2.8.5, 4개 컨트롤러 Running |
| FR-N21.7 | Prometheus + Grafana 배포 | 달성 | 6/6 pods Running, NodePort 접근 |
| FR-N21.8 | 전체 Health Check | 달성 | 모든 서비스 정상 응답 |

---

## 발견된 이슈 및 해결

| 이슈 | 원인 | 해결 |
|------|------|------|
| PostgreSQL 포트 충돌 (5433) | local-postgres 기존 사용 | 5434로 변경 |
| Gitea Health Check unhealthy | REQUIRE_SIGNIN_VIEW + 인증 없는 health check | CMD-SHELL 방식으로 HTTP 상태코드 확인 |
| node-exporter CrashLoop | WSL2 rootfs mount propagation 미지원 | hostRootFsMount.enabled=false |
| Gitea INSTALL_LOCK 미설정 | 첫 실행 시 설치 페이지 상태 | app.ini 직접 수정 |
| Runner 기존 컨테이너 충돌 | 동일 이름 컨테이너 잔존 | docker rm -f 후 재생성 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
