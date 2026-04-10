# Design: MTU-N171 k6 성능 회귀 테스트 자동화

> 버전: 1.0 | 작성일: 2026-04-10

## 1. Design Anchor

- Plan: docs/01-plan/mtus/MTU-N171-k6-perf-regression.plan.md
- 핵심 결정: k6 OSS + k6-operator + Prometheus 출력 + CI/CD 게이트

## 2. 아키텍처

```
PR Push ──→ CI Pipeline ──→ k6 스모크 테스트 (10s/5VU)
                                    │
                               Pass/Fail → PR 코멘트
                                    │
Deploy ──→ k6 부하 테스트 (5m/50VU) ──→ Prometheus
                                              │
                                         Grafana Dashboard
CronJob ──→ k6 소크 테스트 (30m/20VU) ──→ Alert (회귀 탐지)
```

## 3. 상세 설계

### 3.1 k6 테스트 프레임워크

- 공통 유틸: 인증 토큰 발급, 환경 변수 로드, 결과 태깅
- 시나리오별 분리: smoke, load, soak, stress
- Threshold 자동 적용: P95 < baseline * 1.2

### 3.2 성능 기준선 (Baseline)

| API | P95 (ms) | P99 (ms) | 에러율 |
|-----|----------|----------|--------|
| GET /api/health | 50 | 100 | 0% |
| POST /api/auth/login | 200 | 500 | < 1% |
| GET /api/users | 150 | 300 | < 0.5% |
| GET /api/tenants | 100 | 200 | < 0.5% |
| POST /api/ai/query | 2000 | 5000 | < 2% |

### 3.3~3.8 CI/CD 통합, 회귀 탐지, 대시보드 등
- Gitea Actions workflow에서 k6 실행
- 기준선 대비 P95 20% 초과 시 FAIL
- Prometheus remote write로 결과 저장
- Grafana k6 전용 대시보드
