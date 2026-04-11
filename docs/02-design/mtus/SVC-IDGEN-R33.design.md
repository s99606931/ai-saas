# SVC-IDGEN-R33 DESIGN: ID Generator

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## UUID v7 형식
시간 기반 UUID (RFC 9562). 밀리초 타임스탬프 + 랜덤 비트.
시간 순서 정렬 가능하여 DB 인덱스 효율적.

## 접두사 ID 형식
`{prefix}_{uuid}` -- 예: `usr_01912345-6789-7abc-...`
서비스/엔티티 유형을 즉시 식별 가능.

## Session Guide
- `src/id-generator.ts` → `src/index.ts` → `tests/id-generator.test.ts`
- Design Anchor: `// Design Ref: SVC-IDGEN-R33 DESIGN`
