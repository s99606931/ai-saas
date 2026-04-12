# SVC-AI-ADV-R125 — RAG Source Attribution (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Sentence Splitter + Token Overlap Matcher + Citation Builder
- **선정 이유**: Pragmatic Balance — 임베딩 비의존, 결정적·고속·재현성. 임베딩 매칭은 후속 라운드에서 결합 가능
- **대안**:
  1. 임베딩 코사인 — 정확도↑, 비용↑
  2. Token overlap(선정) — 결정적, 빠름
  3. LLM 검증 — 정확도↑, 지연↑

## 인터페이스

```typescript
interface RAGChunk {
  id: string
  source: string  // 문서 식별자/파일경로
  content: string
  grade: DataGrade
}

interface SentenceAttribution {
  index: number
  text: string
  citations: string[]  // chunk ids
  confidence: number
  marked: string       // 본문 + [1][2] 인용 마크
}

interface AttributedAnswer {
  sentences: SentenceAttribution[]
  citationMap: Array<{
    citation: string  // [1]
    chunkId: string
    source: string
    snippet: string   // 청크 일부 (마스킹)
  }>
  avgConfidence: number
  lowConfidence: boolean
}

class RAGSourceAttribution {
  constructor(options?: { minOverlap?: number; lowConfidenceThreshold?: number })
  registerChunk(chunk: RAGChunk): void
  attribute(answer: string): AttributedAnswer
  getAuditLog(): readonly RSAAuditEntry[]
}
```

## 토큰 매칭 알고리즘

1. tokenize(text): 한국어 2-gram + 영어 단어(소문자) 추출
2. Jaccard(sentence_tokens, chunk_tokens) = |∩| / |∪|
3. 임계값 minOverlap(기본 0.15) 이상 청크들 정렬(내림차순) 상위 3개 인용
4. confidence = max overlap

## 문장 분할

```
ko: . ! ? ? ! 。
en: . ! ?
줄바꿈
```

정규식 split + trim, 빈 문장 제거.

## 마스킹 (snippet)

기존 PII 마스킹(이메일/전화/주민번호) + 길이 80자 cap + `…` 부착.

## Session Guide

1. registerChunk()로 검색 결과 청크 등록 (grade O만)
2. attribute(answerText) 호출
3. 결과 sentences[].marked 으로 UI 렌더 (`[1]` `[2]` 등)
4. citationMap으로 출처 박스 표시
5. lowConfidence === true → "출처 신뢰도 낮음" 경고
