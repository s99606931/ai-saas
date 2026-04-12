# SVC-AI-ADV-R362 Design

## 알고리즘
- 코사인 유사도: dot(a,b) / (|a|*|b|) — 사전 계산된 벡터
- BM25: 간소화된 토큰 매칭 스코어
- 최종 = cosineWeight * cos + bm25Weight * bm25 (합=1)
- topK 정렬 반환
