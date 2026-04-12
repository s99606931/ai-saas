# DS-MOL-R1 Plan — 분자 컴포넌트 1차 (FormField/Alert/Card)

> 의존: DS-ATOM-R1, DS-ATOM-R2 (완료)

## Executive Summary

| 관점 | 목표 |
|------|------|
| 비즈니스 | 3개 필수 분자 (Form/Feedback/Container) |
| 사용자 | 접근성 ARIA 라이브 영역, 키보드 탐색 |
| 기술 | 원자 컴포넌트 조합, slot 기반 |
| 운영 | 테스트 커버리지 80%+ |

## Context Anchor

- WHY: 원자만으로 실제 화면을 만들 수 없음. FormField는 모든 업무 폼의 빌딩블록.
- WHO: 포털/어드민 화면 개발자
- SUCCESS:
  - SC-1: FormField — Label + Input + Error/Helper 통합, useId 자동 연결
  - SC-2: Alert — 4 variant, dismissible, 아이콘 자동
  - SC-3: Card — Header/Body/Footer slot, interactive 상태

## 요구사항

| FR | 요구사항 |
|----|---------|
| FR-DSM.1 | FormField: Label(required/optional) + children(input) + error + helper + useId 연결 |
| FR-DSM.2 | FormField: aria-describedby 자동 연결 |
| FR-DSM.3 | Alert: variant(info/success/warning/error), icon 자동 |
| FR-DSM.4 | Alert: dismissible(X 버튼), onDismiss 콜백, role="alert"/"status" |
| FR-DSM.5 | Card: CardHeader/CardBody/CardFooter 서브 컴포넌트 |
| FR-DSM.6 | Card: interactive prop (호버 효과 + 클릭 가능) |
