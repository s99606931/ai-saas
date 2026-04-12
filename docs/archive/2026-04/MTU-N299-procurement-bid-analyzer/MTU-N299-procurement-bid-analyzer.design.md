# MTU-N299-procurement-bid-analyzer: 공공조달 입찰 분석 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 공공조달 입찰 분석 자동화 모듈 |
| 기술 | 입찰 NLP + 적격 평가 |
| 보안 | N2SF O등급 게이트, PII 마스킹, 감사 로그 전수 |
| 운영 | ai-service/lib 단일 모듈, Service 클래스 통합 인터페이스 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Plan WHY 참조 |
| WHO | Plan WHO 참조 |
| RISK | AI 환각, 오탐/미탐, 데이터 등급 위반 |
| SUCCESS | Plan 명시 SC 달성, 감사 100%, 마스킹 100% |
| SCOPE | 입찰 분석,적격 평가,경쟁 분석,감사 |

## 아키텍처 (Pragmatic Balance)

| 옵션 | 채택 |
|------|------|
| A. 마이크로서비스 분리 | ❌ 오버엔지니어링 |
| B. 단일 lib 모듈 | ✅ 빠른 통합, 단순 |
| C. 외부 워크플로우 | ❌ 외부 의존 |

**선택**: B. `platform/services/ai-service/src/lib/procurement-bid-analyzer.ts`

## 모듈 설계

### 핵심 함수 (FR 매핑)

| FR | 기능 | CSAP |
|----|------|------|
| MTU-N299.1 | 입력 검증 + 마스킹 | D-12 |
| MTU-N299.2 | AI 처리 코어 | D-12 |
| MTU-N299.3 | 결과 저장 | D-08 |
| MTU-N299.4 | 검증/조회 | D-08 |
| MTU-N299.5 | 통계/리포트 | D-06 |
| MTU-N299.6 | 감사 로그 | D-06 |

### 보안 게이트

- N2SF: `dataGrade !== 'O'` → 즉시 throw
- PII 마스킹: 주민번호, 전화번호, 이메일 사전 마스킹
- 감사 로그: append-only

### Service 클래스 (통합 인터페이스)

```ts
export class 공공조달입찰분석Service {
  constructor(private tenantId: string) {}
  // 핵심 메서드 + audit() 조회
}
```

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 | 테스트 |
|-------|-----------|------|--------|
| MTU-N299.1 | §모듈설계 | procurement-bid-analyzer.ts | TC-* |
| MTU-N299.2 | §모듈설계 | procurement-bid-analyzer.ts | TC-* |
| MTU-N299.3 | §모듈설계 | procurement-bid-analyzer.ts | TC-* |
| MTU-N299.4 | §모듈설계 | procurement-bid-analyzer.ts | TC-* |
| MTU-N299.5 | §모듈설계 | procurement-bid-analyzer.ts | TC-* |
| MTU-N299.6 | §모듈설계 | procurement-bid-analyzer.ts | TC-* |

## Session Guide

1. lib/procurement-bid-analyzer.ts 구현 확인 또는 생성
2. __tests__/procurement-bid-analyzer.test.ts 작성
3. vitest 통과 확인
4. Design Ref 주석 포함

## Design Anchor

- Module: `platform/services/ai-service/src/lib/procurement-bid-analyzer.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/procurement-bid-analyzer.test.ts`
- 보안: N2SF O등급, PII 마스킹, 감사 로그
- Q-Gate: G1~G7 전체 통과 목표
