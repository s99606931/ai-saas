# MTU-N81: 취약점 자동 패치 파이프라인 — Plan

> **MTU ID**: MTU-N81
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CVE 발견~패치 적용 MTTR 최소화 (Critical: 4시간, High: 24시간) |
| 기술 | Trivy 스캔 → 자동 패치 PR → CI 검증 → 배포 파이프라인 |
| 보안 | CSAP D-12 + S2C2F P7 연계, 제로데이 대응 체계 |
| 운영 | 자동화된 CVE 대응, 에스컬레이션 정책, 감사 추적 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CVE 발표 후 패치 미적용 기간이 공격 윈도우 |
| WHO | DevSecOps 팀, 보안 담당자, CSAP 감사자 |
| RISK | 자동 패치가 서비스 장애 유발 가능 → 스테이징 검증 필수 |
| SUCCESS | Critical CVE MTTR < 4시간, 자동화율 90%+ |
| SCOPE | 자동 패치 워크플로우, 에스컬레이션 정책, 감사 연동 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N81.1 | CVE 심각도별 자동 패치 워크플로우 | HIGH |
| FR-N81.2 | 컨테이너 이미지 자동 리빌드 트리거 | HIGH |
| FR-N81.3 | 패치 적용 전 스테이징 자동 검증 | HIGH |
| FR-N81.4 | 에스컬레이션 정책 (SLA 기반) | HIGH |
| FR-N81.5 | 패치 적용 감사 로그 | MED |
| FR-N81.6 | CVE 대시보드 알림 연동 | MED |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 자동 패치 워크플로우 | infra/security/vuln-patch/workflow.yaml |
| 2 | 에스컬레이션 정책 | infra/security/vuln-patch/escalation-policy.yaml |
| 3 | 리빌드 트리거 CronJob | infra/security/vuln-patch/rebuild-trigger.yaml |
| 4 | 알림 규칙 | infra/security/vuln-patch/alerting-rules.yaml |
| 5 | E2E 테스트 | tests/e2e/test-vuln-patch.sh |
