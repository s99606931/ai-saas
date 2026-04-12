# MTU Plan — SVC-AI-ADV-R146 Bid Award Predictor

> **원 요청 번호**: R146
> **모듈**: `platform/services/ai-service/src/lib/bid-award-predictor.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공 입찰 데이터 기반 낙찰 확률 예측 |
| 기술 | 가중 피쳐 선형 점수 + 시그모이드 변환, 과거 낙찰 분포 비교 |
| 보안 | 업체명 해시 처리, 등급 외 데이터 수집 금지 |
| 규제 | 국가계약법, 조달청 경쟁입찰 투명성 |

## Context Anchor

- WHY: `procurement-bid-analyzer`(분석) + `green-procurement-ai`(친환경) 와 달리 낙찰 확률 예측 특화
- WHO: 조달 담당자, 입찰 의사결정자
- RISK: 입찰가 전략 실패 → 재공고
- SUCCESS: 확률 0..1 결정론, 상위 N 추천 일관
- SCOPE: 입찰 등록→피쳐 수집→스코어링→확률→랭킹

## FR

| ID | 설명 |
|----|------|
| FR-R146.1 | 입찰 등록: bidId, price, techScore, priorWins, experienceYears |
| FR-R146.2 | 예산가 기준 가격점 산출 |
| FR-R146.3 | 가중합 선형 점수 + 시그모이드 확률 |
| FR-R146.4 | 상위 랭킹 반환 |
| FR-R146.5 | 감사 로그 |
| FR-R146.6 | C/S등급 차단 |

## 테스트

- 피쳐 조합별 확률 결정론
- 예산 0 이하 거부
- 랭킹 정렬 확인
- C/S 차단
