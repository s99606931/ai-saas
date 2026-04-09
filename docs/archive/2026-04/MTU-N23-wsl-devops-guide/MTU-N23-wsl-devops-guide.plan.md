# MTU-N23: WSL DevOps 완전 가이드 문서 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **복잡도**: MED | **의존**: MTU-N21, MTU-N22 (실제 경험 기반 작성)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 신규 개발자가 0에서 완전한 DevOps 환경을 자력으로 구축할 수 있는 가이드 제공 |
| 기술 | k3s, Gitea, Harbor, Flux, Prometheus/Grafana 각 도구의 WSL2 특화 설정 안내 |
| 보안 | CSAP/N2SF 컴플라이언스 연계 설명 포함 |
| 운영 | 트러블슈팅 가이드로 장애 대응 시간 단축 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 설계 문서는 아키텍처 관점이며, 실제 "손으로 따라하는" 단계별 가이드가 부재 |
| WHO | 신규 합류 개발자, 운영팀, 프로젝트 관리자 |
| RISK | 과도하게 상세하면 유지보수 비용 증가. 버전 변경 시 갱신 필요 |
| SUCCESS | 클린 WSL2에서 가이드만 따라 30분 내 전체 환경 구축 가능 |
| SCOPE | WSL2 환경 한정. 문서 포맷: 한국어, 행안부 표준 용어 |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N23.1 | 사전 요건 및 시스템 준비 가이드 | Windows/WSL2/Docker 설치 방법 포함 |
| FR-N23.2 | k3s 설치 및 검증 가이드 | 단계별 명령어 + 예상 출력 포함 |
| FR-N23.3 | Gitea 설치 및 초기 설정 가이드 | 관리자 계정, 저장소 생성까지 |
| FR-N23.4 | Harbor 설치 및 프로젝트 설정 가이드 | 이미지 Push/Pull 예제 포함 |
| FR-N23.5 | Flux GitOps 설정 가이드 | Gitea 연동 부트스트랩 |
| FR-N23.6 | Prometheus/Grafana 모니터링 가이드 | 대시보드 접근 및 알림 설정 |
| FR-N23.7 | CI/CD 파이프라인 전체 흐름 가이드 | Push→Build→Deploy 전 과정 |
| FR-N23.8 | 트러블슈팅 가이드 | WSL2 특유 이슈 10개 이상 |
| FR-N23.9 | CSAP/N2SF 컴플라이언스 연계 설명 | 각 도구가 어떤 CSAP 항목을 충족하는지 |

---

## 산출물 목록

| 산출물 | 경로 | 설명 |
|--------|------|------|
| WSL DevOps 완전 가이드 | docs/08-infra/wsl-devops-complete-guide.md | 메인 가이드 문서 |
| 트러블슈팅 가이드 | docs/08-infra/wsl-troubleshooting.md | 문제 해결 안내 |
| 빠른 시작 가이드 | docs/08-infra/wsl-quickstart.md | 5분 요약 가이드 |
| 검증 보고서 | docs/04-report/MTU-N23.report.md | 문서 품질 검증 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
