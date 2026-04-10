# MTU-N219: API 서버 인증/인가 메트릭 모니터링 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 아키텍처 선택

B안 (Pragmatic Balance): Recording Rules 기반 사전 집계 + Grafana 대시보드 + 임계값 알림

## 2. 상세 설계

### 2.1 Recording Rules (FR-N219.1)

핵심 메트릭:
- `apiserver:auth:success_rate` — 인증 성공률 (5m 윈도우)
- `apiserver:auth:failure_rate` — 인증 실패율
- `apiserver:authz:allow_rate` — 인가 허용률
- `apiserver:authz:deny_rate` — 인가 거부율
- `apiserver:auth:failure_by_reason` — 실패 원인별 분류
- `apiserver:token:expiry_soon_count` — 곧 만료 토큰 수

### 2.2 대시보드 구조 (FR-N219.2)

```
Row 1: 인증 종합 (성공률 Stat + 성공/실패 TimeSeries + 실패 원인 PieChart)
Row 2: 인가 종합 (허용률 Stat + 허용/거부 TimeSeries + 거부 리소스 Top10)
Row 3: 토큰/세션 (활성 토큰 Stat + 만료 예정 경고 + 인증자별 분류)
Row 4: 보안 이벤트 (무차별 대입 탐지 + IP별 실패 + 시간대 히트맵)
```

### 2.3 알림 규칙 (FR-N219.3)

| 알림 | 조건 | 심각도 |
|------|------|--------|
| AuthFailureRateHigh | 인증 실패율 > 5% (5m) | warning |
| AuthFailureRateCritical | 인증 실패율 > 20% (5m) | critical |
| AuthzDenySpike | 인가 거부 급증 (3x 평상시) | warning |
| BruteForceDetected | 동일 소스 인증 실패 > 10회/min | critical |
| TokenExpiryImminent | 서비스계정 토큰 만료 < 24h | warning |

## 3. Design Anchor

- Plan: FR-N219.1~N219.3
- CSAP: D-08 접근통제, D-06 감사 로깅
- N2SF: O등급 운영 메트릭
