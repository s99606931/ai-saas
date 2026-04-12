# SVC-AI-ADV-R64 — 설계

## 모듈
- public-api-collector.ts: REST 수집기 + 스키마 추론 + 검증 + 정제
- public-data-agent.ts: 카탈로그 관리 + 스케줄링 + 증분/중복 제거

## 흐름
```
1. registerEndpoint(ep) — 환경변수 이름/라이선스/grade 검증
2. collect(id) — fetcher 호출 → inferSchema → validate → clean → dedupe → limit
3. scheduleAll(interval) — setInterval 기반 주기 수집
```

## 보안 설계
- apiKeyEnv는 환경 변수 이름만 허용 (sk-로 시작하거나 50자 초과 시 차단)
- gradeAllowed='O' 외 거부
- 모든 레코드 SHA256 hash로 중복 제거

## 인터페이스
```typescript
class PublicAPICollector {
  inferSchema(samples: unknown[]): InferredSchema
  validate(data: unknown[], schema: InferredSchema): ValidationResult
  clean(data: unknown[]): unknown[]
}

class PublicDataAgent {
  registerEndpoint(ep: PublicEndpoint): void
  collect(endpointId: string, opts?: CollectOptions): Promise<CollectionResult>
  scheduleAll(intervalMs: number): { stop: () => void }
  listEndpoints(): PublicEndpoint[]
}
```

## 데이터 타입 추론
- string (default)
- number (typeof)
- boolean (typeof)
- date (YYYY-MM-DD 패턴)
- null / object / array / unknown

## 날짜 정규화
- YYYYMMDD → YYYY-MM-DD
- YYYY.MM.DD → YYYY-MM-DD
