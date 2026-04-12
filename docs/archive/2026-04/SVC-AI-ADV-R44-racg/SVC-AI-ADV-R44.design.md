# SVC-AI-ADV-R44 — 설계

## 모듈
- code-context-retriever.ts: 쿼리 기반 관련 코드 조각 검색 (BM25 + 임베딩 하이브리드)
- racg-engine.ts: 검색 결과 + 코딩 표준 + 로컬 LLM → 코드 생성

## 흐름
```
사용자 쿼리 ("함수 XXX 작성해줘")
→ retriever.search (관련 기존 함수 k개 추출)
→ enforceCodingStandard (tab/space, 주석 형식, 네이밍 규칙)
→ 프롬프트 조립 (컨텍스트 + 요구사항 + 표준)
→ 로컬 LLM 호출 (DeepSeek-Coder 등)
→ 후처리 (import 자동 추가, 타입 검증)
→ 생성 코드 반환
```

## 인터페이스
```typescript
interface CodeSnippet { path: string; content: string; score: number; language: string }
class CodeContextRetriever {
  index(files: Array<{path: string; content: string}>): void
  search(query: string, k: number): CodeSnippet[]
}
class RACGEngine {
  generate(query: string, opts?: RACGOptions): Promise<GeneratedCode>
}
```

## 공공기관 코딩 표준 (자동 적용)
- TypeScript 2-space, 함수 80줄 이하
- 한국어 주석 (WHY 위주)
- FR ID 주석 필수 (`// Plan SC: FR-XX.X`)
- 하드코딩 시크릿 금지 검사
