# MTU-N14: E2E CI/CD 검증 스크립트 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N14 |
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
| **WHY** | CI/CD 파이프라인 전체 동작을 end-to-end로 검증하는 스크립트. 설치 후 정상 동작 확인 및 회귀 테스트 |
| **WHO** | DevOps 엔지니어, QA 팀 |
| **RISK** | 비동기 CI 트리거 타이밍 이슈, Harbor 이미지 push 지연 |
| **SUCCESS** | git push -> CI 트리거 -> 이미지 빌드 -> Harbor push -> k3s 배포 -> 헬스체크 전체 통과 |
| **SCOPE** | `scripts/test-cicd-pipeline.sh` |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N14.1 | Gitea 접속 확인 | P0 |
| FR-N14.2 | Harbor 접속 확인 | P0 |
| FR-N14.3 | Act Runner 상태 확인 | P0 |
| FR-N14.4 | k3s 클러스터 상태 확인 | P0 |
| FR-N14.5 | 테스트 커밋 push -> CI 트리거 확인 | P1 |
| FR-N14.6 | Harbor 이미지 존재 확인 | P1 |
| FR-N14.7 | k3s Pod 상태 확인 | P1 |
| FR-N14.8 | 헬스체크 엔드포인트 응답 확인 | P1 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| E2E 검증 스크립트 | `scripts/test-cicd-pipeline.sh` | Bash |
