# Plan: MTU-N169 DORA 4 Metrics 자동화 대시보드

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 플랫폼 엔지니어링 성숙도 정량 측정, 감리 보고 자동화 |
| 기술 | Gitea webhook + Prometheus + Grafana 기반 DORA 4대 지표 파이프라인 |
| 보안 | N2SF O등급 메트릭 데이터만 처리, 외부 전송 없음 |
| 운영 | 자동 수집 → 대시보드 → 주간 리포트, SRE 팀 자율 운영 |

## Context Anchor

- WHY: DevOps 성과 객관적 측정 및 지속적 개선 근거 확보
- WHO: 플랫폼 팀, 개발팀 리드, 경영진
- RISK: 이벤트 파싱 정확도, 장애 분류 자동화 한계
- SUCCESS: 4대 지표 자동 수집, Grafana 시각화, 95%+ 정확도
- SCOPE: 내부 도구만 사용 (Gitea, Prometheus, Grafana)

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-DORA.1 | 배포 빈도(DF) 자동 수집 - Gitea webhook 기반 | HIGH |
| FR-DORA.2 | 변경 리드타임(LT) 자동 계산 - commit→deploy 시간 | HIGH |
| FR-DORA.3 | 변경 실패율(CFR) 자동 분류 - 롤백/핫픽스 탐지 | HIGH |
| FR-DORA.4 | 서비스 복구 시간(MTTR) 자동 측정 - 알림→해결 시간 | HIGH |
| FR-DORA.5 | Prometheus 커스텀 메트릭 정의 및 익스포터 | HIGH |
| FR-DORA.6 | Grafana DORA 대시보드 (팀별/서비스별 필터) | HIGH |
| FR-DORA.7 | 주간/월간 자동 리포트 생성 (PDF/Markdown) | MED |
| FR-DORA.8 | DORA 등급 자동 분류 (Elite/High/Medium/Low) | MED |

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-1 | 메트릭 수집 지연 5분 이내 |
| NFR-2 | 대시보드 로드 시간 3초 이내 |
| NFR-3 | 메트릭 보존 기간 1년 이상 |

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|-----------|---------|--------|------|
| FR-DORA.1 | 3.1 | dora-exporter/ | T-DORA-01 | D-06 |
| FR-DORA.2 | 3.2 | dora-exporter/ | T-DORA-02 | D-06 |
| FR-DORA.3 | 3.3 | dora-exporter/ | T-DORA-03 | D-06 |
| FR-DORA.4 | 3.4 | dora-exporter/ | T-DORA-04 | D-06 |
| FR-DORA.5 | 3.5 | prometheus/ | T-DORA-05 | D-12 |
| FR-DORA.6 | 3.6 | grafana/ | T-DORA-06 | D-12 |
| FR-DORA.7 | 3.7 | report-gen/ | T-DORA-07 | D-06 |
| FR-DORA.8 | 3.8 | dora-exporter/ | T-DORA-08 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 최초 작성 | PM Lead |
