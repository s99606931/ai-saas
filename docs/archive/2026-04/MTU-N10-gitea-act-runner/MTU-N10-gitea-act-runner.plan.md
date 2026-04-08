# MTU-N10: WSL2 Gitea + Act Runner 설치 구성 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N10 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | HIGH |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CI/CD 파이프라인의 핵심 구성 요소인 Gitea(Git 서버) + Act Runner(CI 실행기)를 WSL2 환경에 자동 설치. 온프레미스 공공기관 환경에서 외부 서비스 의존 없이 자체 CI/CD 구축 |
| **WHO** | DevOps 엔지니어, 개발팀, 보안 담당자 |
| **RISK** | Docker Compose 네트워크 충돌, WSL2 포트 바인딩 제한, Act Runner 등록 토큰 관리 |
| **SUCCESS** | Gitea localhost:3000 접속 + Act Runner 등록 완료 + 테스트 워크플로우 실행 성공 |
| **SCOPE** | `infra/gitea/docker-compose.yml`, `scripts/setup-gitea-wsl2.sh`, `scripts/setup-act-runner.sh` |

---

## Executive Summary (4관점)

| 관점 | 목표 | 측정 지표 |
|------|------|---------|
| 기능 | Gitea + Act Runner Docker Compose 자동 설치 | 3개 산출물 완비 |
| 보안 | 환경변수 기반 시크릿 관리, 기본 비밀번호 변경 안내 | CSAP D-09 준수 |
| 품질 | 스크립트 bash -n 통과, 멱등성 지원 | 문법 오류 0건 |
| 운영 | 10분 이내 설치 완료, 문제 해결 가이드 포함 | 설치 시간 측정 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N10.1 | Gitea Docker Compose 정의 (Gitea + PostgreSQL) | P0 |
| FR-N10.2 | Gitea 초기 설정 자동화 (admin 계정, organization) | P0 |
| FR-N10.3 | Act Runner Docker Compose 정의 (Docker socket 마운트) | P0 |
| FR-N10.4 | Act Runner 등록 자동화 (토큰 기반) | P0 |
| FR-N10.5 | 네트워크 설정 (saas-cicd 네트워크) | P1 |
| FR-N10.6 | Volume 영속성 (gitea-data, postgres-data) | P1 |
| FR-N10.7 | self-hosted runner 라벨 설정 | P1 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Gitea Docker Compose | `infra/gitea/docker-compose.yml` | YAML |
| Gitea 환경변수 템플릿 | `infra/gitea/.env.example` | ENV |
| Gitea 설치 스크립트 | `scripts/setup-gitea-wsl2.sh` | Bash |
| Act Runner 설치 스크립트 | `scripts/setup-act-runner.sh` | Bash |
