# SVC-AI-ADV-R3: AI Safety & Guardrails -- 공공기관 AI 안전장치

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 AI 서비스의 안전성 보장: 유해 콘텐츠 차단, 환각(Hallucination) 감지, 프롬프트 주입 방지, 출력 검증 |
| 기술 | 입력 가드레일(프롬프트 주입 탐지, 유해 콘텐츠 필터), 출력 가드레일(환각 감지, 정책 위반 차단), 콘텐츠 분류기 |
| 보안 | CSAP D-12 입력검증 강화, N2SF 데이터 등급 준수, 프롬프트 주입 공격 방어 |
| 운영 | 모든 AI API에 가드레일 미들웨어 적용, 차단 이벤트 감사 로그 |

---

## Context Anchor

### WHY
공공기관 AI 서비스는 높은 신뢰성과 안전성이 요구됩니다. 2026년 AI 안전장치(Guardrails)는 프롬프트 주입 공격 방어, 유해/부적절 콘텐츠 차단, LLM 환각 감지, 정책 준수 검증이 필수입니다. 특히 공공기관 맥락에서 잘못된 법령 인용, 허위 정보 생성은 심각한 문제를 초래합니다.

### WHO
- 공공기관 민원 담당자: 안전한 AI 답변 신뢰
- 보안 관리자: AI 보안 위협 모니터링
- 감사관: AI 안전 정책 준수 검증

### RISK
- 가드레일 과도 적용 시 정상 요청 차단 (완화: 신뢰도 임계값 조정 가능)
- 추가 LLM 호출로 지연 증가 (완화: 경량 규칙 우선, LLM 검증은 선택적)
- 새로운 공격 패턴 대응 필요 (완화: 규칙 동적 업데이트)

### SUCCESS
- SC-1: 프롬프트 주입 탐지 (규칙 + LLM 기반 이중 방어)
- SC-2: 유해 콘텐츠 필터 (공공기관 부적절 용어 사전 + 분류기)
- SC-3: 환각(Hallucination) 감지 (출처 기반 사실 검증)
- SC-4: 출력 정책 가드레일 (데이터 등급, PII 누출 방지)
- SC-5: 가드레일 미들웨어 (모든 AI API에 적용)

### SCOPE
- 포함: ai-guardrails.ts, prompt-injection-detector.ts, content-filter.ts, hallucination-detector.ts
- 제외: 외부 안전 모델 호출 (별도 MTU), UI 변경

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-ADV3.1 | 프롬프트 주입 탐지: 규칙 기반(패턴 매칭) + LLM 기반(이중 방어) | 필수 | 단위 테스트 |
| FR-ADV3.2 | 유해 콘텐츠 필터: 공공기관 부적절 카테고리 12종 차단 | 필수 | 단위 테스트 |
| FR-ADV3.3 | 환각 감지: RAG 답변의 출처 일치도 검증 | 중요 | 단위 테스트 |
| FR-ADV3.4 | 출력 정책 가드레일: PII 누출, 데이터 등급 위반 차단 | 필수 | 단위 테스트 |
| FR-ADV3.5 | 가드레일 파이프라인: 입력→AI처리→출력 전체 단계 적용 | 필수 | 통합 테스트 |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-1 | 규칙 기반 가드레일 지연 < 50ms |
| NFR-2 | LLM 기반 가드레일 지연 < 2초 |
| NFR-3 | 차단 이벤트 100% 감사 로그 기록 |
| NFR-4 | 가드레일 우회 불가 (미들웨어 필수 적용) |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|----------|----------|--------|------|
| FR-ADV3.1 | DESIGN §1 | src/lib/prompt-injection-detector.ts | TBD | D-12 |
| FR-ADV3.2 | DESIGN §2 | src/lib/content-filter.ts | TBD | D-12 |
| FR-ADV3.3 | DESIGN §3 | src/lib/hallucination-detector.ts | TBD | D-12 |
| FR-ADV3.4 | DESIGN §4 | src/lib/ai-guardrails.ts | TBD | D-12, D-09 |
| FR-ADV3.5 | DESIGN §5 | src/lib/ai-guardrails.ts | TBD | D-12 |

---

## 산출물 목록

| 산출물 | 경로 | 유형 |
|--------|------|------|
| 프롬프트 주입 탐지기 | src/lib/prompt-injection-detector.ts | 코드 |
| 콘텐츠 필터 | src/lib/content-filter.ts | 코드 |
| 환각 감지기 | src/lib/hallucination-detector.ts | 코드 |
| 가드레일 파이프라인 | src/lib/ai-guardrails.ts | 코드 |
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R3.design.md | 문서 |
