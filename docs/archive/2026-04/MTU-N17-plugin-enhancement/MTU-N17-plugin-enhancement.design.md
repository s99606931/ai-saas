# MTU-N17: 플러그인 완성도 심화 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N17 |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 아키텍처 | Option B - Pragmatic Balance |

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N17-plugin-enhancement.plan.md |
| 기존 자산 | electronic-approval (테스트 4파일), public-data-integration (테스트 3파일) |
| 테스트 프레임워크 | vitest + Hono testClient/app.request |
| CSAP 매핑 | D-08 접근 통제, D-12 입력 검증 |

---

## 상세 설계

### DESIGN-TEST-1: 전자결재 핸들러 통합 테스트 (FR-N17.1)

```
테스트 파일: platform/plugins/electronic-approval/tests/unit/draft-handler.test.ts

테스트 케이스 구조:
1. POST /drafts — 기안 생성
   - 정상 생성 (201 + id 포함)
   - 인증 없이 접근 시 401 (FR-N17.3)
   - 입력 검증 실패 400 (FR-N17.4)

2. GET /drafts — 기안 목록 조회
   - 정상 조회 (200 + items 배열)
   - 인증 없이 접근 시 401

3. GET /drafts/:id — 기안 상세 조회
   - 정상 조회 (200)
   - 인증 없이 접근 시 401

4. PUT /drafts/:id — 기안 수정
   - 정상 수정 (200)
   - 인증 없이 접근 시 401
   - 입력 검증 실패 400

5. DELETE /drafts/:id — 기안 삭제
   - 정상 삭제 (200 + deleted: true)
   - 인증 없이 접근 시 401

6. POST /drafts/:id/lines — 결재선 설정
   - 정상 설정 (200)
   - 인증 없이 접근 시 401
   - 빈 결재자 배열 400

7. POST /drafts/:id/approve — 승인
   - 정상 승인 (200 + action: approved)
   - 인증 없이 접근 시 401

8. POST /drafts/:id/reject — 반려
   - 정상 반려 (200 + action: rejected)
   - 인증 없이 접근 시 401

9. GET /documents — 문서 목록
   - 정상 조회 (200 + items 배열)
   - 인증 없이 접근 시 401

테스트 방법: Hono app.request() 사용 (HTTP 서버 불필요)
```

### DESIGN-TEST-2: 공공데이터 핸들러 통합 테스트 (FR-N17.2)

```
테스트 파일: platform/plugins/public-data-integration/tests/unit/dataset-handler.test.ts

테스트 케이스 구조:
1. GET /datasets — 데이터셋 검색
   - 정상 검색 (200)
   - 인증 없이 접근 시 401
   - 잘못된 카테고리 400

2. GET /datasets/:id — 데이터셋 상세
   - 정상 조회 (200)
   - 인증 없이 접근 시 401

3. GET /datasets/:id/data — 데이터 조회
   - 정상 조회 (200)
   - 인증 없이 접근 시 401

4. POST /datasets/transform — 데이터 변환
   - 정상 변환 (200)
   - 인증 없이 접근 시 401
   - 입력 검증 실패 400

테스트 방법: Hono app.request() 사용
```

### DESIGN-DOC-1: SDK 사용 예시 문서 (FR-N17.5)

```
문서 경로: docs/api/plugin-sdk-guide.md

구조:
1. 개요: 비즈니스 플러그인 SDK 목적과 아키텍처
2. 빠른 시작: 5분 내 첫 번째 플러그인 생성
3. 서비스 등록: registerService() API
4. CSAP 보안 가드: csapGuard 설정
5. 감사 로그: auditHook 통합
6. 레퍼런스: 전자결재·공공데이터 플러그인 코드 설명
```

---

## Session Guide

```
1단계: 전자결재 핸들러 통합 테스트 생성
2단계: 공공데이터 핸들러 통합 테스트 생성
3단계: SDK 사용 예시 문서 생성
4단계: 전체 테스트 실행 (회귀 확인)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
