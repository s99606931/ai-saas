# CI/CD 파이프라인 성능 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N43 Design

---

## 1. SLA 정의

| 단계 | SLA | 측정 기준 |
|------|-----|---------|
| CI (빌드+테스트) | < 10분 | pnpm install → test 완료 |
| 보안 스캔 | < 5분 | audit + secret scan |
| Docker 빌드 (전체) | < 15분 | matrix 17개 서비스 병렬 |
| SBOM + Grype | < 10분 | 17개 서비스 병렬 |
| Helm 배포 | < 5분 | upgrade --atomic |
| **전체 파이프라인** | **< 20분** | CI → Deploy → Verify |

## 2. 최적화 체크리스트

| 번호 | 최적화 항목 | 효과 | 적용 여부 |
|------|-----------|------|---------|
| 1 | pnpm store 캐싱 | install 60% 단축 | MTU-N38 적용 |
| 2 | Docker BuildKit GHA 캐시 | 빌드 50% 단축 | 기존 적용 |
| 3 | Matrix 병렬 빌드 | 총 시간 80% 단축 | 기존 적용 |
| 4 | concurrency 자동 취소 | 중복 빌드 제거 | MTU-N38 적용 |
| 5 | Helm chart 캐싱 | 배포 10% 단축 | 미적용 (향후) |
| 6 | 조건부 실행 (변경 파일 기반) | 불필요 단계 skip | 미적용 (향후) |
| 7 | Self-hosted Runner SSD | I/O 30% 개선 | 하드웨어 의존 |

## 3. 벤치마크 실행

```bash
# 벤치마크 스크립트 실행
./scripts/benchmark-pipeline.sh

# Grafana 대시보드에서 확인
# Dashboard: CI/CD 파이프라인 메트릭
```

## 4. 모니터링

Grafana 대시보드 `pipeline-metrics-001`에서 다음을 확인:
- 파이프라인 실행 시간 추이
- 단계별 실행 시간 분포
- 빌드 성공률
- SLA 준수 현황

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
