# MTU-N220: Flux/GitOps 동기화 상세 모니터링 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 설계 방향

기존 MTU-N172 Flux 모니터링 확장. B안 (Pragmatic Balance): 소스 유형별 상세 메트릭 + 의존성 시각화 + 리콘실 성능 분석

## 2. 상세 설계

### 2.1 소스 상세 Recording Rules (FR-N220.1)

- 소스 유형별 (GitRepository, OCIRepository, HelmRepository) 가용성
- 리콘실 지속 시간 분포 (P50, P90, P99)
- 소스 페치 지연 및 실패율
- 의존성 체인 깊이 (Kustomization 의존)

### 2.2 상세 대시보드 (FR-N220.2)

```
Row 1: 소스 개요 (유형별 Ready/NotReady 현황 + 전체 가용성)
Row 2: GitRepository 상세 (리비전 추적 + 페치 지연 + 에러)
Row 3: HelmRelease 상세 (차트 버전 + 업그레이드 이력 + 롤백)
Row 4: 리콘실 성능 (지속 시간 히스토그램 + 지연 추이 + 큐 깊이)
Row 5: 의존성/드리프트 (의존성 체인 + 버전 드리프트 + 재시도 현황)
```

### 2.3 상세 알림 규칙 (FR-N220.3)

| 알림 | 조건 | 심각도 |
|------|------|--------|
| FluxSourceFetchFailed | 소스 페치 실패 지속 > 10m | critical |
| FluxReconcileSlowP99 | 리콘실 P99 > 120s | warning |
| FluxVersionDrift | 소스 리비전 ≠ 클러스터 적용 리비전 > 30m | warning |
| FluxDependencyChainBroken | 의존 Kustomization 실패 | critical |
| FluxRetryExhausted | 재시도 횟수 초과 | critical |

## 3. Design Anchor

- Plan: FR-N220.1~N220.3
- CSAP: D-12 시스템 개발 보안
- N2SF: O등급 운영 데이터
