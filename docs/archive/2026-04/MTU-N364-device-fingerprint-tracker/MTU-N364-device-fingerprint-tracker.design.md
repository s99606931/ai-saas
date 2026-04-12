# MTU-N364-device-fingerprint-tracker: 장치 핑거프린팅 추적 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 장치 핑거프린팅 추적 모듈 |
| 기술 | 단일 lib 모듈 + Service 클래스 통합 |
| 보안 | N2SF O등급, 감사 로그 전수 |
| 운영 | ai-service/lib, TypeScript strict |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Plan 참조 (docs/01-plan/mtus/MTU-N364-device-fingerprint-tracker.plan.md) |
| WHO | 공공기관 관리자/운영자 |
| RISK | 테넌트 격리 실패, 감사 로그 누락 |
| SUCCESS | Plan SC 달성 + 단위 테스트 통과 |
| SCOPE | Plan 참조 |

## 아키텍처 (Pragmatic Balance)

**선택**: 단일 lib 모듈 `platform/services/ai-service/src/lib/device-fingerprint-tracker.ts`

## 모듈 설계

### Service 클래스

```ts
export class Device-fingerprint-trackerService {
  constructor(private tenantId: string) {}
  // FR 메서드 + getAuditLog()
}
```

### FR 매핑

| FR | CSAP |
|----|------|
| FR-N364.1~4 | D-06,D-08 |

## 추적성 매트릭스

| FR ID | 구현 | 테스트 |
|-------|------|--------|
| FR-N364.1~4 | device-fingerprint-tracker.ts | __tests__/device-fingerprint-tracker.test.ts |

## Design Anchor

- Module: `platform/services/ai-service/src/lib/device-fingerprint-tracker.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/device-fingerprint-tracker.test.ts`
- Q-Gate: G1~G7 PASS
