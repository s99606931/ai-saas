# SVC-AI-ADV-R383 Design: AI기반 클라우드 네이티브 마이그레이션 어드바이저

## 핵심 알고리즘

### 마이그레이션 복잡도 점수
- `complexityScore = dependencyCount * 10 + techStackComplexity`
- techStackComplexity: legacy(cobol/mainframe) → 40, enterprise(java/dotnet) → 20, modern → 10
- 전략 추천: score >= 70 → 'refactor', >= 40 → 'replatform', else → 'lift-and-shift'

## 클래스 설계

```typescript
class CloudNativeMigrationAdvisor {
  registerApplication(id, name, techStack, dependencyCount): void
  getComplexityScore(appId): ComplexityResult
  getMigrationStrategy(appId): MigrationStrategy
  getTopComplexApps(topN): ComplexityResult[]
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: getComplexityScore, getMigrationStrategy 읽기 전용이라 차단 불필요 (등록 단계에서만 적용)
- 감사 로그: app.register, strategy.evaluate
