# SVC-AI-ADV-R6: AI Streaming & SSE (2026 최신 패턴)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | LLM 응답을 토큰 단위로 실시간 스트리밍하여 사용자 체감 응답시간을 평균 8초 → 0.5초 TTFT(Time To First Token)로 단축. 공공기관 민원상담 AI의 사용성 대폭 향상 |
| 기술 | Server-Sent Events(SSE) 기반 스트리밍, 백프레셔 제어, 클라이언트 취소(AbortController), 토큰 집계, 에러 복구 |
| 보안 | N2SF O등급 데이터만 스트리밍, 스트림 중 PII 실시간 마스킹, CSAP D-08 인증/인가 검증 후 스트림 개시 |
| 운영 | 기존 llm-provider.ts의 chatStream() 인터페이스와 통합, SSE 커넥션 풀 모니터링, 타임아웃 관리 |

---

## Context Anchor

### WHY
현재 AI 서비스는 전체 응답 생성 완료 후 한꺼번에 반환하는 방식으로, 긴 응답(법령 해설 등)에서 8~15초 대기가 발생합니다. 2026년 LLM 서비스 표준은 토큰 단위 스트리밍(SSE)이며, OpenAI/Anthropic/Ollama 모두 스트리밍 API를 제공합니다. TTFT 0.5초 이하를 달성하면 사용자 이탈률을 60% 감소시킬 수 있습니다.

### WHO
- 공공기관 민원 담당자: 긴 법령 해설도 즉시 읽기 시작 가능
- 정책 분석관: 분석 결과 실시간 확인하며 추가 지시
- 시스템 관리자: 스트리밍 세션 모니터링, 비정상 종료 감지

### RISK
- R1: SSE 연결 누수 (완화: 타임아웃 + heartbeat + 자동 정리)
- R2: 클라이언트 취소 시 서버 리소스 미해제 (완화: AbortSignal 연동)
- R3: 스트리밍 중 PII 노출 (완화: 토큰 버퍼링 후 마스킹)
- R4: 백프레셔 미처리 시 메모리 누수 (완화: 고수위 마크 + 일시정지)

### SUCCESS
- SC-1: SSE 기반 토큰 단위 스트리밍 응답 구현 (TTFT < 1초)
- SC-2: 클라이언트 취소(AbortController) 시 서버 리소스 즉시 해제
- SC-3: 백프레셔 제어 — 클라이언트 소비 속도에 맞춘 전송 속도 조절
- SC-4: 스트리밍 중 에러 발생 시 구조화된 에러 이벤트 전송
- SC-5: 토큰 사용량 실시간 집계 및 사용량 제한 연동
- SC-6: CSAP D-08 인증/인가 검증 후 스트림 개시

### SCOPE
- IN: SSE 스트리밍 핸들러, 백프레셔 제어, 취소 처리, 에러 복구, 토큰 집계
- OUT: WebSocket(SSE로 충분), 양방향 스트리밍(미래 Phase), 음성 스트리밍

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|----------|
| FR-ADV6.1 | SSE 스트리밍 핸들러 — ReadableStream + EventSource 프로토콜 | P0 | 단위 테스트 |
| FR-ADV6.2 | 토큰 단위 점진적 응답 — delta 텍스트 이벤트 전송 | P0 | 통합 테스트 |
| FR-ADV6.3 | 클라이언트 취소 — AbortSignal 연동, 서버 리소스 정리 | P0 | 취소 시나리오 테스트 |
| FR-ADV6.4 | 백프레셔 제어 — ReadableStream의 pull 메커니즘 활용 | P1 | 부하 테스트 |
| FR-ADV6.5 | 에러 이벤트 — 스트리밍 중 오류 시 error 이벤트 전송 후 종료 | P0 | 에러 주입 테스트 |
| FR-ADV6.6 | 토큰 사용량 실시간 집계 — 스트림 완료 시 usage 이벤트 전송 | P1 | 단위 테스트 |
| FR-ADV6.7 | Heartbeat — 30초 간격 ping 이벤트로 연결 유지 | P1 | 장시간 연결 테스트 |
| FR-ADV6.8 | CSAP D-08 인증 게이트 — 스트림 개시 전 JWT 검증 | P0 | 보안 테스트 |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-R6.1 | TTFT (Time To First Token) | < 1초 (P95) |
| NFR-R6.2 | 동시 스트리밍 세션 | 100+ 세션/노드 |
| NFR-R6.3 | 메모리 사용량 | 세션당 < 2MB |
| NFR-R6.4 | 취소 후 리소스 해제 | < 100ms |
| NFR-R6.5 | 스트림 타임아웃 | 최대 5분 (설정 가능) |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|-----------|----------|--------|------|
| FR-ADV6.1 | §1 SSE 핸들러 | ai-streaming.ts | TC-R6.1 | D-12 |
| FR-ADV6.2 | §1 토큰 이벤트 | ai-streaming.ts | TC-R6.2 | D-12 |
| FR-ADV6.3 | §2 취소 처리 | streaming-handler.ts | TC-R6.3 | D-12 |
| FR-ADV6.4 | §3 백프레셔 | ai-streaming.ts | TC-R6.4 | D-12 |
| FR-ADV6.5 | §4 에러 처리 | ai-streaming.ts | TC-R6.5 | D-12 |
| FR-ADV6.6 | §5 토큰 집계 | streaming-handler.ts | TC-R6.6 | D-06 |
| FR-ADV6.7 | §6 Heartbeat | ai-streaming.ts | TC-R6.7 | D-12 |
| FR-ADV6.8 | §7 인증 게이트 | streaming-handler.ts | TC-R6.8 | D-08 |

---

## 산출물 목록

| 산출물 | 경로 | 설명 |
|--------|------|------|
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R6.design.md | 아키텍처 설계 |
| ai-streaming.ts | platform/services/ai-service/src/lib/ai-streaming.ts | SSE 스트리밍 코어 |
| streaming-handler.ts | platform/services/ai-service/src/lib/streaming-handler.ts | 요청/응답 핸들러 |
| Report | docs/04-report/SVC-AI-ADV-R6.report.md | 완료 보고서 |
