# SVC-AI-ADV-R323 Design: AI기반 공공 서비스 자동 번역 v2

## 핵심 알고리즘

### 번역 처리
- 용어집(glossary) 등록: sourceTerms → targetTerm
- 번역 시: 원문 내 용어집 sourceTerms 탐지 → targetTerm으로 치환
- 나머지 텍스트: 직접 번역 결과 사용 (입력값 그대로)

### 품질 점수
- glossaryHits = 치환된 용어 수
- qualityScore = min(100, glossaryHits * 20 + baseScore)
- baseScore = 50 (번역 완료 기본값)

## 인터페이스 설계

```typescript
class PublicServiceTranslatorV2 {
  registerGlossary(id, sourceLang, targetLang, terms: Array<{sourceTerms: string[], targetTerm: string}>): void
  translate(glossaryId, sourceText, grade?): TranslationResult
  getQualityScore(translationId): number
  getAuditLog(): AuditEntry[]
}

interface TranslationResult {
  translationId: string
  sourceText: string
  translatedText: string
  glossaryHits: number
  qualityScore: number
}
```
