# MTU-N117: 자동 포스트모템 생성 -- 설계 문서

> 작성일: 2026-04-10 | 버전: 1.1.0
> Plan Ref: docs/01-plan/mtus/MTU-N117-auto-postmortem.plan.md

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 기반 자동 생성 + Markdown 템플릿 + PrometheusRule 연동 |
| 의존성 | Prometheus/Alertmanager 메트릭, Loki 로그, 인시던트 분류 규칙 |
| 산출물 | 포스트모템 템플릿, 타임라인 추출 스크립트, 5 Whys 가이드, 개선 조치 추적, E2E 테스트 |

## 1. 아키텍처 개요

### 1.1 포스트모템 자동 생성 흐름

```
인시던트 발생 (Alertmanager)
  --> 인시던트 분류 (incident-classification-rules.yaml)
  --> P1/P2 인시던트 해소 시 포스트모템 트리거
  --> generate-postmortem.sh 실행
    1. Prometheus API에서 인시던트 타임라인 추출
    2. Loki API에서 관련 로그 수집
    3. 5 Whys 프레임워크 기반 근본 원인 분석 템플릿 채우기
    4. 개선 조치 항목 자동 생성
    5. Markdown 포스트모템 보고서 출력
```

### 1.2 컴포넌트 구성

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 포스트모템 템플릿 | `docs/operations/postmortem-template.md` | 행안부 감리기준 준수 포스트모템 양식 |
| 자동 생성 스크립트 | `scripts/generate-postmortem.sh` | 인시던트 정보 수집 + 보고서 자동 생성 |
| 인시던트 분류 체계 | `docs/operations/incident-severity-matrix.md` | 심각도/영향도 분류 가이드 |
| 5 Whys 가이드 | `docs/operations/five-whys-guide.md` | 근본 원인 분석 프레임워크 |
| 개선 조치 추적 | `docs/operations/postmortem-action-tracker.md` | 개선 조치 체크리스트 + 추적표 |
| PrometheusRule | `infra/monitoring/postmortem-trigger-rules.yaml` | 포스트모템 트리거 조건 규칙 |
| E2E 테스트 | `scripts/test-auto-postmortem.sh` | 전체 기능 검증 |

## 2. 상세 설계

### 2.1 포스트모템 템플릿 (FR-N117.1)

행안부 감리기준 준수 필수 섹션:
- 인시던트 요약 (ID, 일시, 심각도, 영향 범위)
- 타임라인 (자동 추출)
- 근본 원인 분석 (5 Whys)
- 영향 분석 (사용자/서비스/데이터)
- 대응 이력 (누가, 언제, 무엇을)
- 개선 조치 (단기/중기/장기)
- CSAP D-06 감사 추적 링크

### 2.2 타임라인 자동 추출 (FR-N117.2)

Prometheus API (`/api/v1/query_range`)를 사용하여:
- 인시던트 시작/종료 시간 추출
- 관련 메트릭 변화 그래프 데이터
- 에러율, 지연시간, 리소스 사용량 추이

Loki API (`/loki/api/v1/query_range`)를 사용하여:
- 인시던트 기간 로그 추출
- 에러 패턴 집계
- 연관 서비스 로그 상관 분석

### 2.3 근본 원인 분석 (FR-N117.3)

5 Whys 프레임워크 기반 구조화된 분석:
- Why 1~5 단계 질문 템플릿
- 카테고리별 사전 정의 질문 (보안/가용성/성능/인프라)
- 근본 원인 유형 분류 (사람/프로세스/기술)

### 2.4 인시던트 분류 체계 (FR-N117.5)

기존 incident-classification-rules.yaml 기반 확장:
- 심각도: P1(긴급) ~ P4(낮음)
- 영향도: 전체/단일/비프로덕션
- 카테고리: 보안/가용성/성능/인프라/배포/데이터

### 2.5 포스트모템 트리거 규칙

PrometheusRule로 포스트모템 생성 조건 정의:
- P1 인시던트 해소 후 자동 트리거
- P2 인시던트 30분 이상 지속 후 해소 시 트리거
- 수동 트리거 지원 (스크립트 직접 실행)

## 3. CSAP/N2SF 준수

| 통제항목 | 적용 방법 |
|---------|----------|
| D-06 침해사고 관리 | 포스트모템 생성 시 감사 로그 기록, 인시던트 전체 이력 보존 |
| D-12 시스템 개발 보안 | 스크립트 입력 검증, 안전한 API 호출 |
| N2SF N-05 | 포스트모템 내 C/S등급 데이터 마스킹 |

## 4. Session Guide

```
Phase 1: 포스트모템 템플릿 + 인시던트 분류 체계 작성
Phase 2: 자동 생성 스크립트 구현 (타임라인 추출 포함)
Phase 3: 5 Whys 가이드 + 개선 조치 추적 체계
Phase 4: PrometheusRule 트리거 규칙
Phase 5: E2E 테스트 + 검증
```
