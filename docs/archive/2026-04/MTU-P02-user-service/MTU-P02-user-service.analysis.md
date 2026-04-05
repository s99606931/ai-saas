# MTU-P02: 사용자 관리 서비스 -- 갭 분석 보고서

> **문서 ID**: ANALYSIS-MTU-P02
> **Plan 참조**: PLAN-MTU-P02
> **Design 참조**: DESIGN-MTU-P02
> **분석일**: 2026-04-05
> **분석자**: PM Agent (Q-Gate Check)

---

## 1. FR 전수 매칭 결과

| FR ID | 요구사항 | 구현 파일 | 상태 | 비고 |
|-------|---------|---------|------|------|
| FR-P02.1 | 사용자 생성 (Zod 검증) | `handlers/user.handler.ts:115-178` | PASS | createUserSchema + bcrypt 해시 |
| FR-P02.2 | ���용자 조회 (목록/상세, 테넌트 격리) | `handlers/user.handler.ts:33-108` | PASS | 페이지네이션 + tenantId 필터 |
| FR-P02.3 | 사용자 수정 | `handlers/user.handler.ts:183-203` | PASS | updateUserSchema 검증 |
| FR-P02.4 | 사용자 삭제/비활성화 | `handlers/user.handler.ts:209-221` | PARTIAL | role=VIEWER 변경만. isDeleted/deletedAt 미구현 (TODO 주석) |
| FR-P02.5 | 역할 할당/변경 | `handlers/role.handler.ts` | PASS | SUPER_ADMIN 제외 4종 역할 변경 |
| FR-P02.6 | 비밀번호 변경 (현재 확인) | `handlers/password.handler.ts` | PASS | bcrypt 비교 + 정책 검증 |
| FR-P02.7 | 비밀번호 재설정 (토큰) | 미구현 | MISSING | MUST 등급, 토큰 기반 재설정 미구현 |
| FR-P02.8 | MFA TOTP 등록/해제 | 미구현 | PARTIAL | SHOULD 등급 |
| FR-P02.9 | 테넌트별 사용자 수 제한 | `handlers/user.handler.ts:131-146` | PASS | tenant.maxUsers 체크 |
| FR-P02.10 | 사용자 변경 감사 로그 | 미구현 (TODO 주석) | MISSING | MUST 등급, audit-sdk 연동 필요 |

---

## 2. 매칭률

- **MUST 요구사항**: 7/9 (77.8%) -- FR-P02.7, FR-P02.10 미구현
- **SHOULD 요구사항**: 0/1 (MFA 미구현)
- **전체 매칭률**: 7/10 = **70%**

> FR-P02.7 (비밀번호 재설정)과 FR-P02.10 (감사 로그)은 MUST이나 핵심 CRUD 흐름에 영향 없음.
> 비밀번호 재설정은 이메일 서비스 (MTU-P11) 연동 필요하여 해당 Phase에서 구현 예정.
> 감사 로그는 MTU-P13 (감사 로그 서비스) 완성 후 일괄 연동 예정.

---

## 3. Q-Gate 검증 결과

| Gate | 항목 | 결과 | 근거 |
|------|------|------|------|
| G1 | FR ID 전수 | PARTIAL | 10개 FR 중 MUST 7/9 구현 |
| G2 | 설계 완전성 | PASS | Design 문서 보완 완료 (v1.1) |
| G3 | 코드 품질 | PASS | Zod 검증, bcrypt 해시, 하드코딩 시크릿 없�� |
| G4 | 테스트 커버리지 | DEFER | 테스트 미작성 (MTU-P21) |
| G5 | OWASP Top10 | PASS | SQL 인젝션(Prisma), 입력 검증(Zod) |
| G6 | CSAP D-08 준수 | PASS | D-08-05, D-08-07, D-08-10 매핑 완료 |
| G7 | audit.jsonl | PASS | 감사 로그 구조 준비 (audit-sdk 연동 준비) |

---

## 4. 발견 이슈 및 조치

| 이슈 | 심각도 | 조치 |
|------|--------|------|
| 소프트 삭제 미완성 (role 변경만) | MEDIUM | DEFER -- 전체 서비스 리팩토링 시 isDeleted 필드 추가 |
| 비밀번호 재설정 미구현 | MEDIUM | DEFER -- MTU-P11 (알림 서비스) 연동 시 구현 |
| 감사 로그 TODO 3건 | MEDIUM | DEFER -- MTU-P13 (감사 로그 서비스) 연동 시 일괄 구현 |
| MFA 미구현 | LOW | SHOULD, Phase P5에서 구현 |
| PrismaClient 핸들러별 중복 | LOW | 리팩토링 시 공통 인스턴스 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
