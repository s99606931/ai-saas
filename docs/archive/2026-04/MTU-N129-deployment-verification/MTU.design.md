# MTU-N129: 배포 검증 자동화 -- 설계 문서

> 작성일: 2026-04-10

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 + 다단계 검증 파이프라인 |
| 의존성 | Kubernetes API, Prometheus API |
| 산출물 | 검증 스크립트, E2E 테스트 |

## 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 배포 검증 스크립트 | `scripts/verify-deployment.sh` | 다단계 배포 검증 + 보고서 |
| E2E 테스트 | `scripts/test-deployment-verification.sh` | 검증 |

## 검증 단계

| 단계 | 검증 항목 | 판정 기준 |
|------|---------|----------|
| 1. Pod 상태 | Running/Ready | 모든 Pod Ready |
| 2. 헬스체크 | /healthz 응답 | HTTP 200 |
| 3. 에러율 | 5xx 비율 | < 1% |
| 4. 레이턴시 | P99 응답 시간 | < 500ms |
| 5. 리소스 | CPU/Memory 사용량 | < 80% |
