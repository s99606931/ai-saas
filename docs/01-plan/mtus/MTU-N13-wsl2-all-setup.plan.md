# MTU-N13: WSL2 전체 설치 자동화 스크립트 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N13 |
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
| **WHY** | WSL2 환경에서 k3s + Gitea + Harbor + Act Runner를 한 번의 명령으로 설치하는 원클릭 스크립트. 신규 개발자 온보딩 시간 단축 |
| **WHO** | 신규 개발자, DevOps 엔지니어 |
| **RISK** | 의존성 순서 오류, 기존 설치와 충돌, 네트워크/포트 충돌 |
| **SUCCESS** | 단일 스크립트 실행으로 전체 인프라 구성 완료 (15분 이내) |
| **SCOPE** | `scripts/setup-wsl2-all.sh` |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N13.1 | 사전 요건 검사 (Docker, docker-compose, helm, kubectl) | P0 |
| FR-N13.2 | k3s 설치 (이미 있으면 스킵) | P0 |
| FR-N13.3 | Gitea + PostgreSQL Docker Compose 시작 | P0 |
| FR-N13.4 | Harbor 설치 및 시작 | P0 |
| FR-N13.5 | Act Runner 등록 | P0 |
| FR-N13.6 | k3s registries.yaml 설정 | P0 |
| FR-N13.7 | 최종 검증 테스트 | P0 |
| FR-N13.8 | 멱등성 (재실행 시 안전) | P1 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| 원클릭 설치 스크립트 | `scripts/setup-wsl2-all.sh` | Bash |
