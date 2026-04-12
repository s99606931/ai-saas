# MTU-N272: 합성 데이터 생성 — Design

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Design Anchor
| 항목 | 내용 |
|------|------|
| Plan 참조 | MTU-N272 Plan |
| 구현 파일 | `platform/services/ai-service/src/lib/synthetic-data-generator.ts` |

## §1 PII 탐지 (FR-N272.1) — 정규식 + 패턴 매칭
## §2 마스킹 전략 (FR-N272.2) — 대체, 난독화, 토큰화
## §3 합성 데이터 생성 (FR-N272.3) — 통계적 분포 보존
## §4 품질 검증 (FR-N272.4) — KL Divergence, 분포 유사도
## §5 파이프라인 (FR-N272.5) — 자동 실행 흐름
## §6 감사 로그 (FR-N272.6)

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design | PM Lead |
