# SVC-AI-ADV-R373 Design: 지식 베이스 큐레이션

## 품질 점수
- contentLength >= 100 → +25
- title 존재 && length > 5 → +25
- tags.length >= 3 → +25
- lastUpdated < 180일 → +25

## 상태
- score >= 80 → APPROVED
- score >= 60 → PENDING_REVIEW
- lastUpdated > 365일 → OUTDATED
- 그 외 → REJECTED

## 태그 제안
- 콘텐츠에서 키워드 빈도 top3 추출
