# MTU-N461 — 모델 병합 전략 최적화 (FedAvg/FedProx/SCAFFOLD)

## Executive Summary
| 관점 | 내용 |
|------|------|
| 비즈니스 | Non-IID 환경에서 수렴 성능 40% 개선 |
| 기술 | FedProx 근접 항, SCAFFOLD 분산 보정 |
| 규제 | 개보법 가명정보, N2SF |
| 품질 | 3개 전략 벤치마크 |

## Context Anchor
- **WHY**: 기관별 데이터 분포 차이 해소
- **WHO**: ML 엔지니어
- **RISK**: 수렴 실패
- **SUCCESS**: 3전략 비교 가능
- **SCOPE**: `packages/federated-learning/src/strategies/`

## 기능 요구사항
- **FR-FLS.1**: FedProx μ 파라미터
- **FR-FLS.2**: SCAFFOLD control variate
- **FR-FLS.3**: 전략 선택 자동화
- **FR-FLS.4**: 벤치마크 메트릭
- **FR-FLS.5**: 라운드별 결과 비교

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 | PM Lead |
