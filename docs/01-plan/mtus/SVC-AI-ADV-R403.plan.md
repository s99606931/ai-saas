# SVC-AI-ADV-R403 Plan: Public Finance Optimizer

## Context Anchor
- **WHY**: 공공 지출 ROI 평가로 예산 재배분 의사결정 지원
- **WHO**: 재정기획팀, 예산 담당자
- **RISK**: ROI 편향 판단 시 필수 지출 감축 오류
- **SUCCESS**: SC-R403-1 ROI 계산, SC-R403-2 상/하위 식별
- **SCOPE**: 지출 항목 등록, ROI 정렬, 재배분 제안

## 요구사항
- FR-R403.1: 항목 등록 (id, benefit, cost)
- FR-R403.2: roi = benefit / max(cost, 1)
- FR-R403.3: top3 확대 / bottom3 감축 권장
- FR-R403.4: reallocAmount = sum(bottom.cost) * 0.2
- FR-R403.5: N2SF C/S 차단 + CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R403-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R403-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
