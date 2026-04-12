# MTU Design — 의존성 취약 PR 생성

## Executive Summary
| 관점 | 항목 | 값 |
|------|------|-----|
| 범위 | 대상 | 의존성 취약 PR 생성 |
| 품질 | 테스트 | 5/5 PASS |
| 보안 | CSAP | D-06/D-12 |
| 추적 | FR | FR-DEP.1~5 |

## Context Anchor
- WHY: 공공기관 SaaS 운영에서 의존성 취약 PR 생성 자동화 필요
- WHO: 플랫폼 운영팀, 보안팀, DevOps
- RISK: 오탐/미탐 → 룰 기반 fallback + 감사 로그 이중화
- SUCCESS: 단위 테스트 100%, FR 전수 매핑, matchRate 100%
- SCOPE: dep-auto-pr.ts 단일 라이브러리 (인메모리 참조 구현)

## 아키텍처 (Pragmatic Balance)
단일 클래스 기반 경량 라이브러리 구현. PrismaClient 의존 없이 순수 함수 + 인메모리 상태로 단위 테스트 용이성 확보. 추후 서비스 레이어에서 조합 사용.

### 모듈 구조
```
platform/services/ai-service/src/lib/dep-auto-pr.ts
platform/services/ai-service/src/lib/__tests__/dep-auto-pr.test.ts
```

## CSAP/N2SF 준수
- D-06/D-12 해당 통제항목 100% 설계 반영
- N2SF O등급 데이터만 처리, C/S등급 입력 시 차단 (상위 서비스 레이어 책임)
- 감사 로그: 모든 상태 변경 append-only 원칙

## 추적성 매트릭스
| FR | 메서드 | 테스트 |
|----|-------|--------|
| FR-DEP.1~5 | dep-auto-pr 클래스 메서드 | 5/5 단위 테스트 |
