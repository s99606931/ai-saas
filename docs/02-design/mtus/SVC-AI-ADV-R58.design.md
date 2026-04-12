# SVC-AI-ADV-R58 — AI Output Watermarking (Advanced) Design

> 2026-04-12 | v1.0.0

## 1. 개요
Kirchenbauer et al. (2023) "A Watermark for Large Language Models"을 단순화하여
어휘 집합을 시드 기반으로 그린/레드 리스트로 분할하고, 생성 시 그린리스트 토큰에 편향을 가합니다.
검증 시에는 그린리스트 비율의 z-score로 워터마크 여부를 판정합니다.

## 2. 알고리즘

### 그린리스트 생성
```
seedKey = HMAC_SHA256(secret, contextToken)
greenList = sample vocabulary with fraction γ using seedKey
```

### 편향 (biasLogits)
```
for each token t in vocab:
  if t in greenList: logits[t] += δ   // δ=2.0 기본
```

### 검증 (detect)
```
T = 토큰 개수
|green| = greenList에 속한 토큰 개수
z = (|green| - γ*T) / sqrt(T * γ * (1-γ))
watermarked if z > threshold (default 4.0)
```

## 3. HMAC 서명
- `sign(text, meta)` → `HMAC_SHA256(secret, text|meta)`
- `verifySignature(text, meta, sig)` → 일치 여부
- 키: 환경 변수 `AI_WATERMARK_SECRET` (하드코딩 금지)

## 4. 인터페이스
```typescript
export interface WatermarkConfig {
  vocabulary: string[];
  gamma?: number;       // green 비율, 기본 0.5
  delta?: number;       // logit bias, 기본 2.0
  zThreshold?: number;  // 검증 임계값, 기본 4.0
  secret?: string;      // HMAC 키 (없으면 env)
}
export interface DetectResult {
  watermarked: boolean;
  zScore: number;
  greenRatio: number;
  tokens: number;
}
```

## 5. 강건성 평가
- 원본 텍스트 vs 수정 텍스트 z-score 차이 측정
- `assessRobustness(original, modified) → number` (0~1, 1=완전 보존)

## 6. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
