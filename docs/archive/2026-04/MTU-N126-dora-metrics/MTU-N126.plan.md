# MTU-N126: DORA 메트릭 추적 시스템

> 버전: 1.0.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | DORA 4대 메트릭으로 DevOps 성숙도 정량 측정 + 개선 방향 도출 |
| 기술 | Gitea 웹훅 + Prometheus Recording Rule + 분석 스크립트 |
| 보안 | CSAP D-06 침해사고 관리 -- 변경 관리 효과성 측정 |
| 운영 | 주간/월간 DORA 보고서 자동 생성 + 등급 판정 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | DevOps 성숙도를 정량적으로 측정하여 지속적 개선 방향 도출 |
| WHO | SRE팀, DevOps팀, 프로젝트 관리자 |
| RISK | 메트릭 수집 누락 시 개선 방향 판단 불가 |
| SUCCESS | 4대 메트릭 자동 수집 + 등급 판정 + 보고서 생성 |
| SCOPE | Recording Rule + 분석 스크립트 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N126.1 | DORA 4대 메트릭 계산 스크립트 (DF, CLT, MTTR, CFR) | HIGH |
| FR-N126.2 | DORA 메트릭 Recording Rule (Prometheus) | MED |
| FR-N126.3 | 주간/월간 DORA 보고서 자동 생성 | HIGH |
| FR-N126.4 | DORA 등급 자동 판정 (Elite/High/Medium/Low) | MED |
| FR-N126.5 | E2E 테스트 | HIGH |

## DORA 4대 메트릭 정의

| 메트릭 | 약어 | 설명 | Elite | High | Medium | Low |
|--------|------|------|-------|------|--------|-----|
| 배포 빈도 | DF | 프로덕션 배포 횟수 | 일 1회+ | 주 1회+ | 월 1회+ | 월 1회 미만 |
| 변경 리드 타임 | CLT | 커밋~프로덕션 배포 소요 시간 | < 1일 | 1~7일 | 1~6개월 | 6개월+ |
| 변경 실패율 | CFR | 배포 후 롤백/핫픽스 비율 | < 5% | 5~10% | 10~15% | 15%+ |
| 서비스 복구 시간 | MTTR | 장애 감지~복구 평균 시간 | < 1시간 | < 1일 | < 1주 | 1주+ |

## 추적성 매트릭스

| FR | 산출물 | 테스트 | CSAP |
|----|--------|--------|------|
| FR-N126.1 | scripts/generate-dora-report.sh | E2E T01-T04 | D-06 |
| FR-N126.2 | infra/monitoring/dora-metrics-rules.yaml | E2E T05-T08 | D-06 |
| FR-N126.3 | scripts/generate-dora-report.sh | E2E T05-T06 | D-06 |
| FR-N126.4 | scripts/generate-dora-report.sh | E2E T07-T08 | D-06 |
| FR-N126.5 | scripts/test-dora-metrics.sh | 전체 | D-06 |
