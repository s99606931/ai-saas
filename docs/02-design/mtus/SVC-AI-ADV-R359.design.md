# SVC-AI-ADV-R359 Design

## 알고리즘
- priority가 CRITICAL이면 조용시간 무시하고 선호 채널 1순위 선택
- 그 외는 조용시간 체크 후 가능 채널 중 선호 우선순위 선택
- attempt 결과 실패 시 폴백 채널로 재시도 (최대 3회)
- 모든 결정 auditLog에 기록
