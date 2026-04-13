# SVC-AI-ADV-R419 Design — AI기반 서비스 복잡도 자동 감소

## §R419 설계 결정
- 복잡도 지수: dependencyCount×3 + apiCount×2 + linesOfCode/100
- 분류: <10→SIMPLE, <20→MODERATE, <35→COMPLEX, ≥35→OVERLY_COMPLEX
- OVERLY_COMPLEX: 서비스 분리 권고
- COMPLEX: API 수 축소 권고
- dependencyCount ≥ 10: 의존성 감소 권고
- 감사 로그: service.register, complexity.analyze 액션

## 인터페이스
```typescript
interface ServiceComplexityMetric { serviceId, serviceName, dependencyCount, apiCount, linesOfCode, hasCircularDeps }
interface ComplexityAnalysis { serviceId, complexityScore, complexityLevel, splitRecommended, actions: string[] }
interface ComplexityReport { totalServices, overlyComplexCount, averageScore, analyses: ComplexityAnalysis[], priorityActions: string[] }
```
