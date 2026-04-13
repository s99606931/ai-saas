# SVC-AI-ADV-R405 Design: AI기반 자동 테스트 케이스 생성 v2

## 핵심 알고리즘

### 커버리지 계산
- 커버된 유형 집합: Set{positive, negative, edge} 중 실제 존재하는 유형
- `coverageRate = coveredTypes.size / 3 * 100`
- 미커버: testCases 없는 feature

## 클래스 설계

```typescript
class TestCaseGeneratorV2 {
  registerFeature(id, name, complexity): void
  addTestCase(featureId, testCaseId, type, description, grade): void
  getCoverageRate(featureId): number
  getUncoveredFeatures(): FeatureEntry[]
  getAuditLog(): AuditEntry[]
}
```
