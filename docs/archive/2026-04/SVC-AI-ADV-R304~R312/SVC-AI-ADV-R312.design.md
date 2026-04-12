# SVC-AI-ADV-R312 Design: AI기반 이상 탐지 모델 자동 최적화

## 핵심 알고리즘

### F1 점수 계산
- F1 = 2 * precision * recall / (precision + recall)
- precision=0 또는 recall=0이면 F1=0

### 임계값 최적화
- 여러 성능 기록 중 F1이 최대인 레코드의 임계값을 추천
- 데이터 없으면 현재 임계값 유지

## 인터페이스 설계

```typescript
class AnomalyModelOptimizerAI {
  registerModel(id, name, initialThreshold, targetF1): void
  recordPerformance(modelId, threshold, precision, recall, grade?): void
  getOptimalThreshold(modelId): ThresholdRecommendation
  getCurrentF1(modelId): number
  getAuditLog(): AuditEntry[]
}

interface ThresholdRecommendation {
  modelId: string
  currentThreshold: number
  recommendedThreshold: number
  expectedF1: number
}
```
