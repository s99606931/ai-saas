# MTU-N300-info-disclosure-reviewer: 정보공개 청구 자동 심사 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 정보공개 청구 자동 1차 심사 모듈 |
| 기술 | 청구서 분류 + 비공개 사유 8호 매칭 + 심사 결과 생성 |
| 보안 | N2SF O등급 게이트, PII 마스킹, 감사 로그 전수 |
| 운영 | ai-service/lib 단일 모듈, Service 클래스 통합 인터페이스 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Plan §Context Anchor 참조 |
| WHO | 정보공개 담당자, 청구인, 감사관 |
| RISK | 비공개 오판, 민감 정보 유출, 데이터 등급 위반 |
| SUCCESS | 매칭 정확도 85%+, 감사 로그 100% |
| SCOPE | 청구서 파싱 → 비공개 사유 매칭 → 판단 → 선례 검색 → 리포트 |

## 아키텍처 (Pragmatic Balance)

| 옵션 | 채택 |
|------|------|
| A. 마이크로서비스 분리 | ❌ 오버엔지니어링 |
| B. 단일 lib 모듈 | ✅ 빠른 통합, 단순 |
| C. 외부 워크플로우 | ❌ 외부 의존 |

**선택**: B. `platform/services/ai-service/src/lib/info-disclosure-reviewer.ts`

## 모듈 설계

### 핵심 함수 (FR 매핑)

| FR | 기능 | CSAP |
|----|------|------|
| FR-N300.1 | 청구서 텍스트 파싱 및 주제 분류 | D-12 |
| FR-N300.2 | 비공개 사유 8호 매칭 | D-12 |
| FR-N300.3 | 전체/부분/비공개 판단 | D-12 |
| FR-N300.4 | 유사 선례 검색 | D-12 |
| FR-N300.5 | 심사 결과 리포트 생성 | D-08 |
| FR-N300.6 | 감사 로그 | D-06 |

### 정보공개법 비공개 사유 (법 제9조 1항 1~8호)

1. 다른 법률/법규명령에 의해 비공개로 규정된 정보
2. 국가안전보장·국방·통일·외교 관련 정보
3. 공공기관 내부 검토 과정 정보
4. 개인정보 (프라이버시)
5. 법인·단체의 경영·영업상 비밀
6. 진행 중인 재판 관련 정보
7. 감사·감독·계약·시험 등 업무에 지장
8. 부동산 투기 등 특정인 이익/불이익

### 보안 게이트

- N2SF: `dataGrade !== 'O'` → 즉시 throw
- PII 마스킹: 주민번호, 전화번호, 이메일 사전 마스킹
- 감사 로그: append-only

### Service 클래스

```ts
export class InfoDisclosureReviewerService {
  constructor(private tenantId: string) {}
  parseRequest(req: DisclosureRequest): ParsedRequest
  matchExemptions(parsed: ParsedRequest): ExemptionMatch[]
  determineDisclosure(parsed: ParsedRequest, matches: ExemptionMatch[]): DisclosureDecision
  searchPrecedents(topic: string): Precedent[]
  generateReport(decision: DisclosureDecision): ReviewReport
  getAuditLog(): readonly AuditEntry[]
}
```

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 | 테스트 |
|-------|-----------|------|--------|
| FR-N300.1~6 | §모듈설계 | info-disclosure-reviewer.ts | TC-N300.* |

## Session Guide

1. lib/info-disclosure-reviewer.ts 구현
2. __tests__/info-disclosure-reviewer.test.ts 작성
3. vitest 통과 확인
4. Design Ref 주석 포함

## Design Anchor

- Module: `platform/services/ai-service/src/lib/info-disclosure-reviewer.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/info-disclosure-reviewer.test.ts`
- 보안: N2SF O등급, PII 마스킹, 감사 로그
- Q-Gate: G1~G7 전체 통과 목표
