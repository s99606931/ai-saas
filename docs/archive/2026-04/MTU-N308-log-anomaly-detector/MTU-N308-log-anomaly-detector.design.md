# MTU-N308-log-anomaly-detector: 로그 이상 탐지 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 로그 이상 탐지 자동화 모듈 |
| 기술 | 단일 lib 모듈 + Service 클래스 통합 인터페이스 |
| 보안 | N2SF O등급 게이트, PII 마스킹, 감사 로그 전수 |
| 운영 | ai-service/lib, TypeScript strict, vitest |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Plan WHY 참조 |
| WHO | Plan WHO 참조 |
| RISK | 오탐/미탐, 데이터 등급 위반, 테넌트 격리 실패 |
| SUCCESS | Plan SC 달성, 감사 로그 100% |
| SCOPE | Plan SCOPE 참조 |

## 아키텍처 (Pragmatic Balance)

| 옵션 | 채택 |
|------|------|
| A. 마이크로서비스 분리 | ❌ 오버엔지니어링 |
| B. 단일 lib 모듈 | ✅ 빠른 통합, 테넌트 격리 |
| C. 외부 워크플로우 | ❌ 외부 의존 |

**선택**: B. `platform/services/ai-service/src/lib/log-anomaly-detector.ts`

## 모듈 설계

### 핵심 함수 (FR 매핑)

| FR | 기능 | CSAP |
|----|------|------|
| FR-N308.1 | Plan FR-N308.1 구현 | D-12 |
| FR-N308.2 | Plan FR-N308.2 구현 | D-12 |
| FR-N308.3 | Plan FR-N308.3 구현 | D-08 |
| FR-N308.4 | Plan FR-N308.4 구현 | D-08 |
| FR-N308.5 | Plan FR-N308.5 구현 | D-08 |
| FR-N308.6 | 감사 로그 | D-06 |

### 보안 게이트

- 테넌트 격리: Service 인스턴스당 tenantId 고정
- PII 마스킹: 주민번호/전화번호/이메일 사전 처리
- 감사 로그: append-only

### Service 클래스 (통합 인터페이스)

```ts
export class loganomalydetectorService {
  constructor(private tenantId: string) {}
  // Plan §FR 기반 메서드 + getAuditLog()
}
```

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 | 테스트 |
|-------|-----------|------|--------|
| FR-N308.1~6 | §모듈설계 | log-anomaly-detector.ts | TC-N308.* |

## Session Guide

1. lib/log-anomaly-detector.ts 구현 확인
2. __tests__/log-anomaly-detector.test.ts 작성
3. vitest 통과
4. Design Ref 주석 포함

## Design Anchor

- Module: `platform/services/ai-service/src/lib/log-anomaly-detector.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/log-anomaly-detector.test.ts`
- 보안: N2SF O등급, PII 마스킹, 감사 로그
- Q-Gate: G1~G7 전체 통과 목표
