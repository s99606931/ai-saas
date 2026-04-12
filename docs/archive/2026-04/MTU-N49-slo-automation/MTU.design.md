# MTU-N49: SLO/SLI 자동화 (Sloth) — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **Plan 참조**: MTU-N49.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| SLO 도구 | Sloth (경량, CRD 기반, GitOps 친화) |
| SLO 대상 | API Gateway, Auth, Tenant, Audit, AI Gateway |
| 알림 방식 | Multi-window multi-burn rate (Google SRE 표준) |
| 에러 버짓 | 30일 rolling window |

---

## SLO 정의

| 서비스 | SLI | SLO Target | 에러 버짓 (30일) |
|--------|-----|-----------|----------------|
| API Gateway | 성공률 (non-5xx) | 99.9% | 43.2분 |
| API Gateway | P95 지연시간 < 500ms | 99% | 432분 |
| Auth Service | 인증 성공률 | 99.95% | 21.6분 |
| Tenant Service | CRUD 성공률 | 99.9% | 43.2분 |
| Audit Service | 로그 기록 성공률 | 99.99% | 4.3분 |
| AI Gateway | 응답 성공률 | 99.5% | 216분 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
