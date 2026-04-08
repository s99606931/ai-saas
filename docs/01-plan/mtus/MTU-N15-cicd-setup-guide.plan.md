# MTU-N15: WSL2 CI/CD 설치 가이드 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N15 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | MED |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | WSL2 환경 CI/CD 구성의 단계별 가이드 문서. 신규 팀원 온보딩 및 운영 참조 문서 |
| **WHO** | 신규 개발자, 운영팀, 감리 담당자 |
| **RISK** | 문서와 실제 스크립트 불일치, 버전 변경 시 업데이트 누락 |
| **SUCCESS** | 문서만으로 WSL2 CI/CD 환경 구축 가능 |
| **SCOPE** | `docs/infra/wsl2-cicd-setup-guide.md` |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N15.1 | WSL2 사전 요구사항 명세 | P0 |
| FR-N15.2 | 단계별 설치 순서 문서화 | P0 |
| FR-N15.3 | Gitea 초기 설정 가이드 | P0 |
| FR-N15.4 | Harbor 프로젝트 설정 가이드 | P0 |
| FR-N15.5 | Gitea Secrets 설정 방법 | P0 |
| FR-N15.6 | 파이프라인 첫 실행 방법 | P0 |
| FR-N15.7 | 문제 해결 가이드 (FAQ 10개+) | P1 |
| FR-N15.8 | 아키텍처 다이어그램 (ASCII) | P1 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| CI/CD 설치 가이드 | `docs/infra/wsl2-cicd-setup-guide.md` | Markdown |
