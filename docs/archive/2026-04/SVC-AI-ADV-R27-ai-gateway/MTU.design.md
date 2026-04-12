# SVC-AI-ADV-R27: AI Gateway DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

통합 API + 제공자 풀 + 폴백 + 지능형 라우팅

---

## §1 통합 API (FR-ADV27.1)

OpenAI 호환 /v1/chat/completions 엔드포인트
요청: messages, model, temperature, max_tokens, stream
내부에서 제공자별 포맷으로 변환

## §2 제공자 풀 (FR-ADV27.2)

Provider: id, name, baseUrl, apiKey(암호화), models[], status, healthCheck
상태: active → degraded → down → maintenance

## §3 폴백 체인 (FR-ADV27.3)

체인: primary → secondary → tertiary → local
전환 조건: HTTP 5xx × 3회 연속, 또는 지연 > 30초

## §4 지능형 라우팅 (FR-ADV27.4)

점수 = cost * 0.3 + latency * 0.3 + quality * 0.4
최적 제공자: 점수 최고 + 현재 active

## §5 비용 추적 (FR-ADV27.5)

토큰 단가 테이블: 제공자/모델별
집계: 테넌트별 일/월 토큰 소비 + 예산 대비 %

## §6 요청 변환 (FR-ADV27.6)

어댑터 패턴: OpenAI → Anthropic, OpenAI → Ollama
응답 정규화: 제공자 응답 → 통합 응답 포맷
