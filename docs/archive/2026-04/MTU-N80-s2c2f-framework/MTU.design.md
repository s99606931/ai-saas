# MTU-N80: S2C2F 공급망 소비 프레임워크 — Design

> **MTU ID**: MTU-N80
> **Plan 참조**: docs/01-plan/mtus/MTU-N80-s2c2f-framework.plan.md
> **작성일**: 2026-04-10
> **상태**: Design 완료

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 프레임워크 | OpenSSF S2C2F (Microsoft 기여) |
| 목표 성숙도 | Level 3 (Verified Ingestion) |
| 정책 엔진 | Kyverno (기존 인프라 활용) |
| SBOM 연계 | Syft/Grype (기존 MTU-N37 연계) |

## S2C2F 8대 실천항목 매핑

| # | 실천항목 | 자동화 방법 | 성숙도 레벨 |
|---|---------|------------|-----------|
| 1 | Ingest (인입) | Renovate Bot 자동 감지 | L1 |
| 2 | Scan (스캔) | Grype/Trivy 취약점 스캔 | L1 |
| 3 | Inventory (목록) | SBOM 자동 생성 (Syft) | L2 |
| 4 | Update (갱신) | Renovate 자동 PR + 자동머지 | L2 |
| 5 | Enforce (강제) | Kyverno 정책으로 미검증 이미지 차단 | L3 |
| 6 | Rebuild (재빌드) | Hermetic Build 환경 (Gitea Actions) | L3 |
| 7 | Fix+Upstream (수정) | CVE 패치 자동 적용 + upstream PR | L3 |
| 8 | Audit (감사) | 전수 감사 로그 + CSAP D-06 | L2 |

## Kyverno 정책 설계

### 의존성 출처 검증 정책
- 허용된 레지스트리만 사용 (Harbor 내부 미러)
- 이미지 서명 필수 (Cosign 검증)
- SBOM 첨부 필수 (in-toto attestation)
- 취약점 스캔 결과 기반 차단 (critical/high)

### 라이선스 호환성 검사
- 허용 라이선스: MIT, Apache-2.0, BSD-2/3, ISC, MPL-2.0
- 금지 라이선스: AGPL, GPL (SaaS 호환성 문제)
- SSPL, BSL: 개별 검토 필요

## 성숙도 평가 기준

| 레벨 | 항목 | 기준 |
|------|------|------|
| L1 | 의존성 인지 | 모든 의존성 목록화, 취약점 스캔 |
| L2 | 의존성 관리 | SBOM 자동 생성, 자동 갱신, 감사 로그 |
| L3 | 의존성 검증 | 출처 검증, 서명 확인, 정책 강제, 재빌드 가능 |
| L4 | 완전 제어 | 내부 포크, 패치 관리, upstream 기여 |
