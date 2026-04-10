# MTU-N110: FinOps 비용 예측 및 예산 자동 알림 — Design

> **MTU ID**: MTU-N110 | **작성일**: 2026-04-10

---

## 아키텍처: Pragmatic Balance

```
OpenCost -> Prometheus (비용 메트릭) -> 예측 모델 (Prophet)
                                              |
                                        예측 비용 메트릭
                                              |
                                    AlertManager (예산 초과 알림)
                                              |
                                    Slack / Email / PagerDuty
```

### DS-N110.1: 비용 예측 모델

- OpenCost 메트릭에서 네임스페이스별 일일 비용 추출
- Prophet으로 월말까지 비용 예측 (선형 추세 + 계절성)
- 예측 월비용 vs 예산 비교

### DS-N110.2: 예산 정책 (티어별)

| 티어 | 월예산 | 경고 임계값 | 차단 임계값 |
|------|--------|-----------|-----------|
| basic | 50만원 | 80% | 100% |
| standard | 200만원 | 80% | 100% |
| enterprise | 무제한 | 80% 예측 | 알림만 |

### DS-N110.3: 알림 규칙

- 50% 도달: 정보성 알림
- 80% 도달: 경고 알림 (관리자)
- 100% 예측 초과: 긴급 알림 (관리자 + PM)
- 비정상 비용 급증 (일일 +30%): 이상 알림

## Design Anchor

- Plan SC: FR-N110.1~FR-N110.5 전수 반영
- N97 FinOps 대시보드와 연동
