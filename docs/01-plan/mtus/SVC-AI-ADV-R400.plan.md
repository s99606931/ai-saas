# SVC-AI-ADV-R400 Plan: Public Safety Score Engine

## Context Anchor
- **WHY**: 지역별 안전 점수 통합 산출로 정책 우선순위 결정
- **WHO**: 안전 정책 담당자
- **RISK**: 단일 영역 편중 평가 시 왜곡
- **SUCCESS**: SC-R400-1 영역별 점수, SC-R400-2 종합 등급
- **SCOPE**: 영역별 발생률 입력, 종합 안전 점수 출력

## 요구사항
- FR-R400.1: crime/fire/accident/disaster 각 영역 점수 계산
- FR-R400.2: score = 100 - min(rate*scale, 100)
- FR-R400.3: totalScore = 평균
- FR-R400.4: riskFactors (score<60 영역)
- FR-R400.5: CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R400-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R400-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
