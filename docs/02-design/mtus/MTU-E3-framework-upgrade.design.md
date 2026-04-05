# MTU-E3: 프레임워크 버전 관리 및 업그레이드 절차 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-E3 |
| Phase | Phase 5 Ecosystem |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-E3-framework-upgrade.plan.md` |
| FR 매핑 | FR-8.6 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | CSAP/N2SF/ISMS-P 규정 변경 시 30일 SLA 내 프레임워크 반영 필수 |
| WHO | CTO (MAJOR 승인), 보안 아키텍트 (영향 분석), 운영팀 (배포) |
| RISK | 업그레이드가 기존 인증 무효화 → 서비스 중단 |
| SUCCESS | 시맨틱 버저닝 + 30일 SLA + 불변 증적 + 롤백 절차 |

---

## 1. 아키텍처 옵션 평가

### Option A: 비정형 업데이트
- 장점: 빠른 반영
- 단점: 인증 영향 추적 불가, 롤백 불가

### Option B: 시맨틱 버저닝 + 파이프라인 (선택)
- 장점: MAJOR/MINOR/PATCH 구분, 인증 영향 사전 평가, 롤백 가능
- 단점: 프로세스 오버헤드
- **선택 근거**: 공공기관 인증 유지가 최우선 — 변경 영향 추적 필수

### Option C: 고정 릴리스 주기
- 장점: 예측 가능
- 단점: 긴급 규정 변경 시 30일 SLA 미충족

**최종 선택: Option B (시맨틱 버저닝 + 파이프라인)**

---

## 2. 산출물 구조

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `14-framework-upgrade/version-management-guide.md` | 절차서 | 버전 체계 + 변경 분류 + CHANGELOG 관리 |
| `14-framework-upgrade/upgrade-procedure.md` | 절차서 | 업그레이드 파이프라인 + 검증 + 롤백 |

---

## 3. Design Anchor

- Plan SC: FR-8.6 (프레임워크 업그레이드)
- Design Ref: MTU-A7 N2SF 모니터링 (30일 SLA 공유)
- Design Ref: CLAUDE.md 절대 제약 (force push 금지, 감사 추적 보존)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B 시맨틱 버저닝 선택 | Claude Code |
