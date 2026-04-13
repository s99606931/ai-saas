# SVC-AI-ADV-R396 Plan: Public Benefits Calculator

## Context Anchor
- **WHY**: 공공급여 자격/지원금 자동 산정으로 신청자 편의성 증대
- **WHO**: 복지 담당자, 민원인
- **RISK**: 오산정 시 지급 오류 발생
- **SUCCESS**: SC-R396-1 자격 판단, SC-R396-2 지원금 계산
- **SCOPE**: 급여 프로그램 등록, 신청자 평가

## 요구사항
- FR-R396.1: 급여 프로그램 등록 (incomeCap, minAge, baseAmount, perMemberBonus)
- FR-R396.2: 자격 = income ≤ cap && age ≥ minAge
- FR-R396.3: totalAmount = base + perMemberBonus*(householdSize-1)
- FR-R396.4: N2SF C/S 등급 차단
- FR-R396.5: CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R396-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R396-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
