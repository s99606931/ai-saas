# SVC-FEATUREFLAG-R40 DESIGN: Feature Flags

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 플래그 정의

```ts
FlagDefinition = {
  name: string
  enabled: boolean              // 마스터 스위치
  rollout?: number              // 0~100 (%)
  allowList?: string[]          // 강제 포함
  denyList?: string[]           // 강제 제외
  segments?: Segment[]
}

Segment = {
  attribute: string             // 'tenant', 'region', 'role'
  operator: 'equals' | 'in' | 'startsWith'
  value: string | string[]
}
```

## 퍼센트 평가
- `hash(flagName + subject) % 100 < rollout`
- FNV-1a 해시로 일관성 보장 (동일 subject는 항상 동일 결과)

## Session Guide
- `src/feature-flags.ts` → `src/index.ts` → `tests/feature-flags.test.ts`
