# SVC-AI-ADV-R280 Design: AI기반 멀티모달 문서 이해 v2

## 핵심 알고리즘

### 문서 파싱
- 섹션: title, content, type('text'|'table'|'image'), keywords[]
- 키워드는 content를 tokenize하여 자동 추출 (2자 이상 단어)

### 키워드 검색
- 쿼리 토큰이 섹션 title(2점) 또는 keywords(1점)에 포함되는지 점수화
- 점수 내림차순 정렬

### 요약 생성
- 상위 N개 섹션의 title + content 앞 50자 연결

## 인터페이스 설계

```typescript
class MultimodalDocumentUnderstandingV2 {
  registerDocument(id, title, docType): void
  addSection(docId, title, content, sectionType): void
  searchSections(docId, query): SectionSearchResult[]
  summarize(docId, topN): DocumentSummary
  getAuditLog(): AuditEntry[]
}
```
