# MTU-N273: GitOps 드리프트 수정 — Design

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Design Anchor
| 항목 | 내용 |
|------|------|
| Plan 참조 | MTU-N273 Plan |
| 구현 파일 | `platform/services/ai-service/src/lib/gitops-drift-detector.ts` |

## §1 선언적 상태 파싱 (FR-N273.1) — YAML/JSON → 정규화
## §2 실제 상태 수집 (FR-N273.2) — 리소스 스냅샷
## §3 드리프트 감지 (FR-N273.3) — deep diff + 카테고리 분류
## §4 자동 수정 정책 (FR-N273.4) — 규칙 기반 자동 복구
## §5 영향 분석 (FR-N273.5) — 수정 전 시뮬레이션
## §6 감사 로그 (FR-N273.6)

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design | PM Lead |
