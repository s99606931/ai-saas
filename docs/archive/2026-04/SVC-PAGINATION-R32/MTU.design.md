# SVC-PAGINATION-R32 DESIGN: Cursor-based Pagination

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-PAGINATION-R32.plan.md

## Cursor 인코딩

Base64 인코딩된 JSON: `{ id: string, sortValue?: unknown }`

## 응답 형식

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "hasNext": true,
    "hasPrevious": false,
    "nextCursor": "eyJpZCI6IjUwIn0=",
    "previousCursor": null
  }
}
```

## Session Guide
- `src/pagination.ts` → `src/index.ts` → `tests/pagination.test.ts`
- Design Anchor: `// Design Ref: SVC-PAGINATION-R32 DESIGN`
