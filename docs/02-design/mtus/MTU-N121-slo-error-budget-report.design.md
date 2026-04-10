# MTU-N121: SLO 에러 예산 자동 리포팅 -- 설계 문서

> 작성일: 2026-04-10 | 버전: 1.0.0
> Plan Ref: docs/01-plan/mtus/MTU-N121-slo-error-budget-report.plan.md

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 + Prometheus API + Markdown 보고서 |
| 의존성 | slo-error-budget-alerts.yaml, recording-rules.yaml, SLO 대시보드 |
| 산출물 | 보고서 생성 스크립트, Recording Rule, E2E 테스트 |

## 1. 아키텍처

```
Prometheus Recording Rules (SLI/SLO 메트릭)
  --> generate-slo-report.sh (주간/월간 자동 실행)
    1. Prometheus API 쿼리 (에러 예산 잔여율, SLI 달성률)
    2. MTTR/MTTD 계산 (인시던트 이력 기반)
    3. 에러 예산 소진 추이 분석
    4. Markdown 보고서 생성
  --> docs/reports/slo/ 디렉토리에 출력
```

## 2. 컴포넌트 구성

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 보고서 생성 스크립트 | `scripts/generate-slo-report.sh` | SLO 리포트 자동 생성 |
| Recording Rule 확장 | `infra/monitoring/slo-reporting-rules.yaml` | 리포팅용 집계 메트릭 |
| E2E 테스트 | `scripts/test-slo-report.sh` | 전체 기능 검증 |

## 3. 상세 설계

### 3.1 SLO 보고서 생성 (FR-N121.1, FR-N121.2)

서비스별 SLI/SLO 달성률 테이블:
- 서비스명, SLO 목표, 현재 SLI, 달성 여부
- 에러 예산 잔여율, 소진 속도
- 30일 윈도우 기준

### 3.2 Recording Rule (FR-N121.3)

에러 예산 소진 추이를 Recording Rule로 사전 계산:
- 일간 에러 예산 소진량
- 주간 누적 소진량
- 월간 에러 예산 잔여율 예측

### 3.3 MTTR/MTTD 계산 (FR-N121.4)

Prometheus ALERTS 히스토리 기반:
- MTTD: 알림 발생 시각 -- 감지 시각 차이
- MTTR: 알림 발생 -- 해소 시각 차이
- 서비스별/카테고리별 평균 MTTR

### 3.4 에러 예산 소진 예측 (FR-N121.5)

현재 소진 속도 기반 선형 회귀로 에러 예산 소진 예정일 예측.

## 4. CSAP/N2SF 준수

| 통제항목 | 적용 방법 |
|---------|----------|
| D-06 | SLO 위반 이력 감사 추적, 리포트 생성 로그 기록 |
| D-12 | 스크립트 입력 검증, 안전한 API 호출 |
