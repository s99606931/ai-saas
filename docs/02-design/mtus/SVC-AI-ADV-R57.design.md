# SVC-AI-ADV-R57 — Privacy-Preserving Inference Design

> 2026-04-12 | v1.0.0

## 1. 개요
차분 프라이버시(DP) 메커니즘과 k-익명화 검증을 통해 AI 응답의 재식별 위험을 낮춥니다.

## 2. 메커니즘

### 라플라스 메커니즘
```
M(D) = f(D) + Lap(Δf/ε)
Lap(b) = -b * sign(u) * ln(1 - 2*|u|), u ~ Uniform(-0.5, 0.5)
```

### 가우시안 메커니즘
```
M(D) = f(D) + N(0, σ²)
σ = Δf * sqrt(2 * ln(1.25/δ)) / ε
```

## 3. k-익명화
- 그룹 크기 < k 인 경우 `checkKAnonymity` false 반환
- 기본 k=5

## 4. 엡실론 예산
```typescript
interface PrivacyBudget {
  total: number;    // ε_total
  consumed: number;
  remaining: number;
}
```
- `consumeBudget(eps)` → remaining < 0 이면 예외 `DP_BUDGET_EXCEEDED`

## 5. 인터페이스
```typescript
export interface DPConfig {
  epsilon: number;
  delta?: number;
  sensitivity?: number;  // Δf, default 1
}
```

## 6. RNG
- 테스트 결정성을 위해 주입 가능한 `rng: () => number` (기본 Math.random)

## 7. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
