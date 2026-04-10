# MTU-N132: 운영 대시보드 통합 — Plan

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 33개 분산 대시보드를 단일 진입점으로 통합하여 운영 효율 극대화 |
| 기술 | Grafana 홈 대시보드 + 네비게이션 허브 + 상태 집약 패널 구현 |
| 보안 | CSAP D-06 감사 추적, D-08 접근 통제 포함 대시보드 |
| 운영 | MTTR 50% 단축 목표, 모든 SRE 도구 1-클릭 접근 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 33개 대시보드가 분산되어 인시던트 시 탐색 시간 과다. 단일 진입점 필요 |
| WHO | SRE 팀, 운영 관리자, 보안 감사원 |
| RISK | 대시보드 과밀로 렌더링 지연, 정보 과부하 |
| SUCCESS | 단일 대시보드에서 모든 영역 상태 확인 + 상세 드릴다운 |
| SCOPE | Grafana 홈 대시보드 + 네비게이션 스크립트 + Recording Rules |

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|----------|
| FR-N132.1 | 통합 운영 홈 대시보드 (6개 영역 상태 집약) | 클러스터/SLO/인시던트/보안/비용/배포 상태 표시 |
| FR-N132.2 | 영역별 드릴다운 링크 (기존 33개 대시보드 연결) | 각 영역 클릭 시 상세 대시보드 이동 |
| FR-N132.3 | 통합 상태 Recording Rules | 각 영역 정상/경고/위험 3단계 집약 메트릭 |
| FR-N132.4 | 대시보드 네비게이션 생성 스크립트 | 모든 대시보드 목록 자동 생성 + 카테고리 분류 |
| FR-N132.5 | 운영 대시보드 검증 테스트 | 대시보드 JSON 유효성 + Recording Rule 구문 검증 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Plan 문서 (본 문서) | docs/01-plan/mtus/MTU-N132.plan.md |
| 2 | Design 문서 | docs/02-design/mtus/MTU-N132.design.md |
| 3 | 통합 홈 대시보드 | infra/monitoring/dashboards/ops-hub-home.json |
| 4 | 통합 Recording Rules | infra/monitoring/ops-hub-recording-rules.yaml |
| 5 | 네비게이션 생성 스크립트 | scripts/generate-ops-hub.sh |
| 6 | 검증 테스트 | scripts/test-ops-hub.sh |

## 의존성

- MTU-N125~N131 (SRE 도구 세트) -- 완료
- 기존 33개 Grafana 대시보드 -- 존재 확인 완료

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 작성 | PM Lead |
