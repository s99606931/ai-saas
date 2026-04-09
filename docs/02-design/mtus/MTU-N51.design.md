# MTU-N51: 빌드 매트릭스 병렬화 + CI 최적화 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **Plan 참조**: MTU-N51.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| Matrix 전략 | 서비스별 병렬 빌드 (max-parallel: 4) |
| Dockerfile | 3단계: deps → build → runtime |
| 캐시 | Docker layer cache + pnpm store cache |
| 증분 테스트 | git diff 기반 변경 서비스 탐지 |

---

## Matrix 빌드 구조

```
[Push Event]
     ↓
[Detect Changes] → git diff --name-only
     ↓
[Matrix Strategy]
  ├─ [api-gateway]     → Build → Test → Push
  ├─ [auth-service]    → Build → Test → Push
  ├─ [tenant-service]  → Build → Test → Push
  ├─ [audit-service]   → Build → Test → Push
  └─ [ai-gateway]      → Build → Test → Push
     ↓ (병렬 실행)
[Summary] → 전체 결과 집계
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
