# MTU-N17: 플러그인 완성도 심화 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N17 |
| Phase | Phase 4 Enhancement |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | MED |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 전자결재·공공데이터 플러그인의 핸들러 통합 테스트가 누락. 단위 테스트만으로는 HTTP 요청/응답 흐름 검증 불충분. SDK 사용 예시 문서가 없어 외부 개발자 온보딩 장벽 존재 |
| **WHO** | 플러그인 개발자, 외부 SI 업체, 감리 위원 |
| **RISK** | 핸들러 테스트 추가 시 기존 테스트 회귀 가능성, Hono 프레임워크 테스트 유틸리티 의존성 |
| **SUCCESS** | (1) 전자결재 핸들러 통합 테스트 9개 엔드포인트 커버, (2) 공공데이터 핸들러 통합 테스트 4개 엔드포인트 커버, (3) SDK 사용 예시 문서 작성, (4) 기존 1000개 테스트 회귀 0건 |
| **SCOPE** | `platform/plugins/electronic-approval/tests/`, `platform/plugins/public-data-integration/tests/`, `docs/api/plugin-sdk-guide.md` |

---

## Executive Summary (4관점)

| 관점 | 목표 | 측정 지표 |
|------|------|---------|
| 기능 | 핸들러 통합 테스트 13개 엔드포인트 커버 | 테스트 케이스 30개+ |
| 보안 | CSAP D-08 인증 없는 접근 거부 검증 | 401 응답 테스트 포함 |
| 품질 | 플러그인 테스트 커버리지 90%+ | vitest coverage 결과 |
| 문서 | SDK 사용 예시 가이드 | 완성된 문서 1개 |

---

## 기능 요구사항

| FR ID | 요구사항 | 산출물 | 검증 기준 |
|-------|---------|--------|---------|
| FR-N17.1 | 전자결재 핸들러 통합 테스트: 9개 엔드포인트 | draft.handler.test.ts | POST/GET/PUT/DELETE drafts, lines, approve/reject/hold, documents |
| FR-N17.2 | 공공데이터 핸들러 통합 테스트: 4개 엔드포인트 | dataset.handler.test.ts | GET datasets, datasets/:id, datasets/:id/data, POST transform |
| FR-N17.3 | 인증 없는 접근 401 거부 테스트 (CSAP D-08) | 각 handler.test.ts | 모든 엔드포인트에서 x-user-id/x-tenant-id 없이 401 반환 확인 |
| FR-N17.4 | 입력 검증 실패 400 응답 테스트 (CSAP D-12) | 각 handler.test.ts | Zod 검증 실패 시 400 + error 필드 |
| FR-N17.5 | 플러그인 SDK 사용 예시 문서 | plugin-sdk-guide.md | registerService, csapGuard, auditHook 사용법 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|------------|---------|-------|------|
| FR-N17.1 | DESIGN-TEST-1 | draft.handler.test.ts | 자체 | D-12 |
| FR-N17.2 | DESIGN-TEST-2 | dataset.handler.test.ts | 자체 | D-12 |
| FR-N17.3 | DESIGN-SEC-1 | 각 handler.test.ts | 자체 | D-08 |
| FR-N17.4 | DESIGN-SEC-2 | 각 handler.test.ts | 자체 | D-12 |
| FR-N17.5 | DESIGN-DOC-1 | plugin-sdk-guide.md | 리뷰 | - |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
