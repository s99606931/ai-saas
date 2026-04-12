# MTU Plan — SVC-AI-ADV-R145 Document Intent Classifier

> **원 요청 번호**: R145
> **모듈**: `platform/services/ai-service/src/lib/document-intent-classifier.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 서류(민원·신고·건의·문의)를 학습 데이터 없이 자동 분류 |
| 기술 | 룰+키워드 가중치 스코어링, 의미 기반 인텐트 매칭 |
| 보안 | 개인정보 마스킹 전제, O등급만 처리 |
| 규제 | 민원처리법 서류 분류 자동화, CSAP D-12 입력 검증 |

## Context Anchor

- WHY: 기존 `zero-shot-classifier`(범용)와 달리 공공기관 서류 intent 특화
- WHO: 민원 자동 접수 시스템, 시민 포털
- RISK: 오분류 → 민원 지연 배정
- SUCCESS: Top-1 정확도 측정 가능, 재현 가능 스코어
- SCOPE: 인텐트 등록→키워드 가중치→분류→Top-K

## FR

| ID | 설명 |
|----|------|
| FR-R145.1 | 인텐트 정의 등록 (label, keywords, weight) |
| FR-R145.2 | 텍스트 분류 → 인텐트별 스코어 산출 |
| FR-R145.3 | Top-K 결과 정렬 반환 |
| FR-R145.4 | 신뢰도 임계값 이하 시 'unknown' 반환 |
| FR-R145.5 | 감사 로그 |
| FR-R145.6 | C/S등급 차단 |

## 테스트

- 4개 인텐트 정의 → 올바른 분류
- 임계값 미달 → unknown
- 빈 텍스트 처리
