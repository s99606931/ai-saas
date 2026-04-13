# SVC-AI-ADV-R401 Plan: AI Contract Risk Scorer

## Context Anchor
- **WHY**: 계약 조항 리스크 정량화로 법무 검토 우선순위 결정
- **WHO**: 법무팀, 계약 관리자
- **RISK**: 고위험 조항 간과 시 손해 발생
- **SUCCESS**: SC-R401-1 조항별 점수, SC-R401-2 전체 리스크 등급
- **SCOPE**: 계약서 조항 입력, 리스크 점수/등급 출력

## 요구사항
- FR-R401.1: riskKeywords { critical, high, med }
- FR-R401.2: clauseScore = critical*40 + high*25 + med*10 (clip 100)
- FR-R401.3: overall = 조항 점수 평균
- FR-R401.4: grade (low/med/high)
- FR-R401.5: N2SF C/S 등급 차단 + CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R401-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R401-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
