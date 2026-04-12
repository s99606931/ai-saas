# MTU-N460 — 차등 프라이버시 집계 고도화 (DP-SGD)

## Executive Summary
| 관점 | 내용 |
|------|------|
| 비즈니스 | 개인정보 보호하며 통계 집계 |
| 기술 | Laplace/Gaussian 노이즈 + 예산 관리 |
| 규제 | 개보법 가명처리, N2SF O등급 변환 |
| 품질 | ε-δ 예산 추적 |

## Context Anchor
- **WHY**: 통계 쿼리에 DP 노이즈 추가로 재식별 방지
- **WHO**: 통계 담당자, 연구자
- **RISK**: 예산 소진 후 쿼리 허용, 재식별
- **SUCCESS**: ε 예산 추적 정확도 100%
- **SCOPE**: `packages/federated-learning/`

## 기능 요구사항
- **FR-DP.1**: Laplace 메커니즘 (count/sum)
- **FR-DP.2**: Gaussian 메커니즘 (DP-SGD)
- **FR-DP.3**: 예산 관리자 (ε, δ)
- **FR-DP.4**: 쿼리 감사
- **FR-DP.5**: 합성 데이터 생성

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 | PM Lead |
