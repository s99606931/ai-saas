# MTU-N281: 전자결재 AI 어시스턴트 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 기안문 자동 생성 + 결재선 추천 + 템플릿 관리 통합 모듈 |
| 기술 | 단일 책임 함수 + Service 클래스 + In-memory 감사 큐 |
| 보안 | N2SF O등급 검증 게이트, PII 마스킹 사전 적용 |
| 운영 | ai-service/lib 단일 모듈, Fastify 라우트 통합 가능 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 기안 작성/결재 프로세스 자동화 |
| WHO | 공무원, 결재권자, 시스템 관리자 |
| RISK | AI 환각, 결재선 추천 오류 |
| SUCCESS | 적합률 90%+, 추천 정확도 85%+, 마스킹 100%, 감사 100% |
| SCOPE | 기안 생성, 결재선 추천, 템플릿 CRUD, 수정 제안, 패턴 학습, 감사 |

## 아키텍처 (3-옵션 → Pragmatic Balance 채택)

| 옵션 | 장점 | 단점 | 채택 |
|------|------|------|------|
| A. 마이크로 분리 | 명확 분리 | 오버엔지 | ❌ |
| B. 단일 lib 모듈 | 빠른 통합, 단순 | 향후 분리 필요 | ✅ |
| C. 외부 워크플로우 엔진 | 확장성 | 외부 의존 | ❌ |

**선택**: B. `platform/services/ai-service/src/lib/electronic-approval-ai.ts` 단일 모듈.

## 모듈 설계

### 1. 타입 정의

```ts
export interface DraftRequest { topic: string; keywords: string[]; tenantId: string; author: string; dataGrade: 'O' | 'C' | 'S'; }
export interface DraftResult { draftId: string; title: string; body: string; createdAt: string; }
export interface ApprovalLine { approverId: string; order: number; role: string; reason: string; }
export interface DraftTemplate { templateId: string; name: string; body: string; }
```

### 2. 핵심 함수 (FR 매핑)

| 함수 | FR | CSAP |
|------|----|----|
| `generateDraft(req)` | FR-N281.1 | D-12 |
| `recommendApprovalLine(orgChart, draft)` | FR-N281.2 | D-08 |
| `createTemplate/listTemplates/...` | FR-N281.3 | D-12 |
| `suggestCorrections(text)` | FR-N281.4 | D-12 |
| `learnFromHistory(history)` | FR-N281.5 | D-06 |
| `recordAudit(...)` | FR-N281.6 | D-06 |

### 3. 보안 게이트

- 입력 진입 시 `dataGrade !== 'O'` → 즉시 throw
- PII 정규식 (주민번호, 전화번호, 이메일) 마스킹

### 4. Service 클래스

```ts
export class ElectronicApprovalAiService {
  constructor(private tenantId: string) {}
  draft(req): DraftResult
  recommend(orgChart, draft): ApprovalLine[]
  templates(): DraftTemplate[]
  audit(): readonly AuditEntry[]
}
```

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 | 테스트 |
|-------|-----------|------|--------|
| FR-N281.1 | §모듈설계.2 | electronic-approval-ai.ts | TC-1~3 |
| FR-N281.2 | §모듈설계.2 | electronic-approval-ai.ts | TC-4~6 |
| FR-N281.3 | §모듈설계.2 | electronic-approval-ai.ts | TC-7~8 |
| FR-N281.4 | §모듈설계.2 | electronic-approval-ai.ts | TC-9 |
| FR-N281.5 | §모듈설계.2 | electronic-approval-ai.ts | TC-10 |
| FR-N281.6 | §모듈설계.2 | electronic-approval-ai.ts | TC-11~12 |

## Session Guide

1. lib/electronic-approval-ai.ts 생성
2. tests 작성 → vitest 통과 확인
3. Design Ref 주석 포함

## Design Anchor

- Module: `platform/services/ai-service/src/lib/electronic-approval-ai.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/electronic-approval-ai.test.ts`
- 보안: N2SF O등급 게이트, PII 마스킹, append-only audit
