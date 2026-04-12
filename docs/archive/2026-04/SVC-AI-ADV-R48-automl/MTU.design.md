# SVC-AI-ADV-R48 — 설계

## 모듈
- query-plan-analyzer.ts: PostgreSQL EXPLAIN 출력 파싱 → 문제 식별 → 인덱스 추천
- automl-optimizer.ts: API latency 통계 분석 → 병목 탐지 → 최적화 제안

## 쿼리 플랜 분석 패턴
- Seq Scan on large table (cost > 1000)
- Nested Loop (rows * rows > 1M)
- Sort (memory) — work_mem 부족
- Hash Join (key mismatch)
- Missing index (WHERE/JOIN 컬럼)

## API 병목 분석
- P95 latency > 500ms → 병목
- 에러율 > 1% → 불안정
- 호출 빈도 × 평균 latency → 영향도 스코어

## 인터페이스
```typescript
interface QueryPlanNode { nodeType: string; cost: number; rows: number; children: QueryPlanNode[] }
class QueryPlanAnalyzer {
  parse(explainOutput: string): QueryPlanNode
  analyze(plan: QueryPlanNode, query: string): PlanAnalysisResult
  recommendIndexes(result: PlanAnalysisResult): IndexRecommendation[]
}
class AutoMLOptimizer {
  analyzeAPIMetrics(metrics: APIMetric[]): BottleneckReport
  suggest(report: BottleneckReport): Suggestion[]
}
```
