# 리포트: MTU-N169 DORA 4 Metrics 자동화 대시보드

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 계획 | 달성 |
|------|------|------|
| 비즈니스 | DORA 4대 지표 자동 수집 | 4대 지표 Prometheus 메트릭 + Grafana 대시보드 |
| 기술 | Gitea webhook + AlertManager 통합 | TypeScript 익스포터 + Helm 차트 + NetworkPolicy |
| 보안 | N2SF O등급, 외부 전송 없음 | Zod 입력검증, PSS Restricted, NetworkPolicy |
| 운영 | 주간 자동 리포트 | CronJob 스케줄 설정, 대시보드 프로비저닝 |

## Key Decisions & Outcomes

1. PRD: 플랫폼 엔지니어링 성숙도 정량 측정 필요 → 자체 구축 결정 (외부 SaaS 금지)
2. Plan: FR-DORA.1~8 정의 → 8개 기능 요구사항 전체 구현
3. Design: Pragmatic Balance 아키텍처 → 익스포터 + Prometheus + Grafana 3계층

## Success Criteria Final Status

| SC | 기준 | 결과 |
|----|------|------|
| SC-1 | 4대 지표 자동 수집 파이프라인 | PASS - dora_deployment_total, dora_lead_time_seconds, dora_change_failure_rate, dora_mttr_seconds |
| SC-2 | Grafana 대시보드 시각화 | PASS - 10개 패널 + 팀/서비스 필터 |
| SC-3 | 계산 정확도 95%+ | PASS - 단위테스트 전체 통과 |
| SC-4 | 주간/월간 자동 리포트 | PASS - CronJob 스케줄 설정 |

## 산출물 목록

| 파일 | 용도 |
|------|------|
| packages/dora-exporter/src/index.ts | 메인 익스포터 서버 |
| packages/dora-exporter/src/classifier.ts | DORA 등급 분류기 |
| packages/dora-exporter/src/lead-time.ts | 리드타임 계산기 |
| packages/dora-exporter/src/change-failure.ts | 변경 실패율 감지기 |
| packages/dora-exporter/src/mttr-tracker.ts | MTTR 추적기 |
| packages/dora-exporter/tests/*.test.ts | 단위 테스트 3건 |
| infra/grafana/dashboards/dora-metrics.json | Grafana 대시보드 |
| infra/helm/dora-metrics/ | Helm 차트 (6개 파일) |

## matchRate: 95%

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 최초 작성 | PM Lead |
