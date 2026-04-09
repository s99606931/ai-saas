# Plan: MTU-N34 Kyverno Policy Reporter 설치

| 항목 | 내용 |
|------|------|
| 문서 ID | PLAN-N34-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| PRD 참조 | PRD-N34-001 |
| 복잡도 | MED |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 정책 위반 시각화로 보안 운영 효율성 향상 |
| 기술 | Policy Reporter + UI + Kyverno Plugin + Prometheus 연동 |
| 보안 | CSAP D-05/D-12 준수 증적 자동 수집 |
| 운영 | 기존 모니터링 스택(Prometheus+Grafana)과 통합 |

## Context Anchor

- **WHY**: Kyverno Enforce 모드 전환 후 정책 결과 시각화 부재
- **WHO**: 보안 운영자, 클러스터 관리자, 감리인
- **RISK**: WSL2 리소스 제한, reportsController 비활성
- **SUCCESS**: UI 접근 + Prometheus 메트릭 + Grafana 대시보드
- **SCOPE**: Policy Reporter Core + UI + Kyverno Plugin + Monitoring

---

## 기능 요구사항

| FR ID | 설명 | 우선순위 | 수용 기준 |
|-------|------|---------|---------|
| FR-N34.1 | Policy Reporter Helm Chart 설치 | MUST | policy-reporter NS에 Pod Running |
| FR-N34.2 | Policy Reporter UI 활성화 | MUST | NodePort 접근 가능 |
| FR-N34.3 | Kyverno Plugin 활성화 | MUST | 정책 결과 UI에서 확인 가능 |
| FR-N34.4 | Prometheus ServiceMonitor 연동 | MUST | Prometheus 타겟에 policy-reporter 표시 |
| FR-N34.5 | Grafana 대시보드 프로비저닝 | SHOULD | Grafana에 Policy Reporter 대시보드 표시 |
| FR-N34.6 | WSL2 최소 리소스 values.yaml | MUST | 메모리 요청 128Mi 이하 |
| FR-N34.7 | 설치 가이드 문서 | MUST | docs/07-infra/policy-reporter-guide.md |

## 비기능 요구사항

| NFR ID | 설명 | 기준 |
|--------|------|------|
| NFR-N34.1 | 설치 후 기존 58 pods 영향 없음 | 전체 Running 유지 |
| NFR-N34.2 | 메모리 사용 최소화 | Pod당 128Mi 이하 |

## CSAP 매핑

| CSAP 항목 | 설명 | FR 매핑 |
|-----------|------|---------|
| D-05-03 | 정보보호 관리 체계 운영 | FR-N34.1~3 |
| D-06-01 | 보안 이벤트 모니터링 | FR-N34.4~5 |
| D-12-08 | 보안 관제 | FR-N34.1~5 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| values.yaml | infra/kyverno/policy-reporter-values.yaml | YAML |
| 설치 가이드 | docs/07-infra/policy-reporter-guide.md | Markdown |
| Plan 문서 | docs/01-plan/mtus/MTU-N34-policy-reporter.plan.md | Markdown |
| Design 문서 | docs/02-design/mtus/MTU-N34-policy-reporter.design.md | Markdown |
| Report 문서 | docs/04-report/MTU-N34-policy-reporter.report.md | Markdown |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
