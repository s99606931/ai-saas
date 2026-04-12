# SVC-AI-ADV-R8: AI Cost Optimizer (LLM 비용 절감)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 시맨틱 캐싱으로 동일/유사 질문 중복 호출 70% 절감, 동적 모델 라우팅으로 단순 질문은 저비용 모델 사용, 토큰 예산 관리로 테넌트별 비용 통제 |
| 기술 | 코사인 유사도 기반 시맨틱 캐시, 복잡도 분류기(keyword/simple→Haiku, complex→Sonnet, expert→Opus), 토큰 예산 선제 차단 |
| 보안 | 캐시 키에 PII 미포함, 테넌트 격리 캐시, N2SF O등급 데이터만 캐싱 |
| 운영 | 캐시 히트율/비용 절감 대시보드, 모델별 사용량 분석, 예산 소진 알림 |

---

## Context Anchor

### WHY
LLM API 비용은 공공기관 SaaS 운영비의 상당 부분을 차지합니다. "주민등록 등본 발급 방법" 같은 반복 질문에 매번 LLM을 호출하는 것은 비효율적입니다. 2026년 최신 기법인 시맨틱 캐싱(유사 질문 캐시 히트)과 복잡도 기반 모델 라우팅을 적용하면 70% 이상 비용 절감이 가능합니다.

### WHO
- 시스템 관리자: 비용 모니터링, 예산 설정
- 테넌트 관리자: 자체 예산 관리, 사용량 확인
- AI 서비스 엔진: 자동 최적화 적용

### RISK
- R1: 시맨틱 캐시 오적중 (완화: 유사도 임계값 0.92, 만료 정책)
- R2: 복잡도 오분류로 품질 저하 (완화: 사용자 피드백 기반 보정)
- R3: 캐시 무효화 지연 (완화: TTL + 수동 무효화 API)

### SUCCESS
- SC-1: 시맨틱 캐시 구현 — 코사인 유사도 0.92+ 시 캐시 히트
- SC-2: 동적 모델 라우팅 — 복잡도 기반 Haiku/Sonnet/Opus 자동 선택
- SC-3: 토큰 예산 관리 — 테넌트별 일/월 예산 설정 및 선제 차단
- SC-4: 비용 메트릭 수집 — 모델별 호출 수, 토큰 수, 예상 비용
- SC-5: 캐시 히트율 70%+ (반복 질문 시나리오)

### SCOPE
- IN: 시맨틱 캐시, 동적 모델 라우팅, 토큰 예산, 비용 메트릭
- OUT: 외부 캐시 서비스(Redis), 과금 시스템 통합

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|----------|
| FR-ADV8.1 | 시맨틱 캐시 — 임베딩 유사도 기반 캐시 조회/저장 | P0 | 단위 테스트 |
| FR-ADV8.2 | 캐시 키 생성 — 쿼리 정규화 + PII 제거 후 임베딩 | P0 | 테스트 |
| FR-ADV8.3 | 캐시 만료 정책 — TTL + LRU 합성 | P1 | 테스트 |
| FR-ADV8.4 | 동적 모델 라우팅 — 복잡도 분류기 | P0 | 분류 정확도 테스트 |
| FR-ADV8.5 | 토큰 예산 관리 — 일/월 한도 설정 및 차단 | P0 | 한도 초과 테스트 |
| FR-ADV8.6 | 비용 메트릭 수집 — 모델별 통계 | P1 | 메트릭 검증 |
| FR-ADV8.7 | 캐시 무효화 API | P1 | API 테스트 |
| FR-ADV8.8 | 테넌트 격리 — 캐시 키에 tenantId 포함 | P0 | 격리 테스트 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | CSAP |
|-------|-----------|----------|------|
| FR-ADV8.1 | §1 시맨틱 캐시 | semantic-cache.ts | D-12 |
| FR-ADV8.2 | §1 캐시 키 | semantic-cache.ts | D-12, N-05 |
| FR-ADV8.3 | §1 만료 정책 | semantic-cache.ts | D-12 |
| FR-ADV8.4 | §2 모델 라우팅 | cost-optimizer.ts | D-12 |
| FR-ADV8.5 | §3 토큰 예산 | token-budget.ts | D-10 |
| FR-ADV8.6 | §4 메트릭 | cost-optimizer.ts | D-06 |
| FR-ADV8.7 | §1 무효화 | semantic-cache.ts | D-12 |
| FR-ADV8.8 | §1 테넌트 격리 | semantic-cache.ts | D-08 |

---

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| semantic-cache.ts | platform/services/ai-service/src/lib/semantic-cache.ts |
| cost-optimizer.ts | platform/services/ai-service/src/lib/cost-optimizer.ts |
| token-budget.ts | platform/services/ai-service/src/lib/token-budget.ts |
