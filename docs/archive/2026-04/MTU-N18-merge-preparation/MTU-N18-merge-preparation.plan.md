# MTU-N18: stg -> main 머지 준비 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N18 |
| Phase | Phase 5 Release |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | LOW |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | stg 브랜치에 53개 MTU 산출물이 누적. main 브랜치로 PR 생성을 위한 사전 준비 (CHANGELOG, PR 체크리스트, 릴리스 노트 최종 검토) |
| **WHO** | 프로젝트 관리자, 감리 위원, 배포 담당자 |
| **RISK** | 실제 머지는 사용자 승인 필요. 이 MTU는 문서 준비만 수행 |
| **SUCCESS** | (1) CHANGELOG v1.0.0 최종 정리, (2) PR 체크리스트 문서, (3) 릴리스 노트 최종 검토 |
| **SCOPE** | `CHANGELOG.md`, `docs/release/pr-checklist.md` |

---

## 기능 요구사항

| FR ID | 요구사항 | 산출물 |
|-------|---------|--------|
| FR-N18.1 | CHANGELOG v1.0.0 최종 정리 | CHANGELOG.md |
| FR-N18.2 | PR 머지 체크리스트 | docs/release/pr-checklist.md |
| FR-N18.3 | 릴리스 노트 최종 검토 | 기존 문서 검토 결과 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
