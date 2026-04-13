# SVC-AI-ADV-R395 Plan: AI-Driven Meeting Scheduler

## Context Anchor
- **WHY**: 참석자 가용성/선호도/회의실 제약 종합 고려하여 회의 슬롯 자동 최적화
- **WHO**: 행정 지원팀, 회의 주관 담당자
- **RISK**: 부적절 슬롯 배정 시 참석률 저하
- **SUCCESS**: SC-R395-1 슬롯 점수화, SC-R395-2 상위 3개 추천
- **SCOPE**: 참석자/회의실 입력, 후보 슬롯 점수/순위 출력

## 요구사항
- FR-R395.1: 후보 슬롯 점수 계산 (availability*0.5 + preference*0.3 + roomFit*0.2)
- FR-R395.2: 점수 내림차순 상위 3개 추천
- FR-R395.3: N2SF C/S 등급 차단
- FR-R395.4: CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R395-SC01: 단위 테스트 5개+ 통과
- SVC-AI-ADV-R395-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
