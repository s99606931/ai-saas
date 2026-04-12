# SVC-AI-ADV-R41 — 테스트 생성기 설계

> 2026-04-12 | v1.0.0

## 모듈
- test-generator-ai.ts: AST 파싱 → LLM 프롬프트 → Vitest 케이스 생성
- test-scenario-builder.ts: CSAP D-06/D-08/D-09/D-12 시나리오 템플릿 → 테스트 스펙 변환

## 흐름
```
소스 코드 → AST 분석 → 함수 추출 → {각 함수별: 입력/출력/예외 케이스 추론}
  → CSAP 시나리오 오버레이 (test-scenario-builder)
  → Vitest 형식 출력
  → 생성 테스트 구문 검증 (syntax check)
```

## 인터페이스
```typescript
interface TestCaseSpec { name: string; input: unknown; expected: unknown; category: 'unit'|'integration'|'security' }
class TestGeneratorAI {
  generate(sourceCode: string, opts?: {framework: 'vitest'|'jest'}): Promise<GeneratedSuite>
  validate(testCode: string): ValidationResult
}
class TestScenarioBuilder {
  forCSAP(control: 'D-06'|'D-08'|'D-09'|'D-12'): TestCaseSpec[]
  forOWASP(top: number): TestCaseSpec[]
}
```

## 보안
- 소스 코드에 하드코딩 시크릿 감지 시 생성 차단 + 경고
- 생성된 테스트는 감사 로그 기록
