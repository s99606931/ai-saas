# SVC-AI-ADV-R273 — 설계

## 구조

```
indexDocument({docId, title, body, tags[]})
  → tokenize (소문자, 알파+숫자+한글)
  → term frequency Map
search(query, { topN=10, tags? }) → SearchResult[]
  → IDF 계산: log(N / df)
  → 문서 점수 = Σ tf(t) * idf(t)
  → 태그 매칭 시 점수 * 1.5
```
