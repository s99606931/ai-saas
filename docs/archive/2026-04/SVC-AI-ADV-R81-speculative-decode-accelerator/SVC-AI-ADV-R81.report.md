# SVC-AI-ADV-R81 — Report (Speculative Decoding)

## Summary
Draft+Verify 2단계 토큰 디코딩으로 LLM 추론 가속. Adaptive k + EMA 수락률 갱신. 수락 0 시 verify 단독 폴백.

## Key Decisions
- 모델 호출은 주입형 함수 (DraftFn/VerifyFn)로 추상화 → 테스트 용이
- targetRate 0.65, initialK 4, 범위 [2,8]

## SC
- FR-R81.1 ✅ / R81.2 ✅ / R81.3 ✅ / R81.4 ✅ / R81.5 ✅

## 이슈
- R76~R80 기존 세션 계획이 사용자 지시와 다름 → 사용자 지시 주제(Speculative Decoding)를 R81로 재배정해 기존 추적성 보존
