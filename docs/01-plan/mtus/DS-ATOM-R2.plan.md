# DS-ATOM-R2 Plan — 폼 원자 컴포넌트 (Input/Textarea/Checkbox/Switch/Label)

> 의존: DS-TOKEN-R1, DS-ATOM-R1 (완료)
> 작성일: 2026-04-13

## Executive Summary

| 관점 | 항목 | 목표 |
|------|------|------|
| 비즈니스 | 폼 컴포넌트 | 5개 (Input/Textarea/Checkbox/Switch/Label) |
| 사용자 | 접근성 | aria-invalid, aria-describedby, 포커스 링 |
| 기술 | 상태 표현 | default/hover/focus/error/disabled |
| 운영 | 테스트 커버리지 | 80%+ |

## Context Anchor

- WHY: 폼은 모든 업무 애플리케이션의 핵심. Button만으로는 업무 플로우 불가.
- WHO: 관리자 포털, 카탈로그 편집, 사용자 관리 화면 개발자
- RISK: aria 속성 누락 시 KWCAG 5.4.5(레이블) 위반. 에러 상태 시각화 미흡 시 UX 실패.
- SUCCESS:
  - SC-1: Input — type 9종, error/success 상태, leadingIcon/trailingIcon
  - SC-2: Textarea — 자동 크기 조절 옵션
  - SC-3: Checkbox — indeterminate 지원, 키보드 탐색
  - SC-4: Switch — on/off 토글, aria-checked
  - SC-5: Label — Input과 연결 (htmlFor)

## 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DSA.12 | Input: text/email/password/number/search/tel/url/date/time |
| FR-DSA.13 | Input: leadingIcon/trailingIcon/errorMessage |
| FR-DSA.14 | Textarea: autoResize prop, minRows/maxRows |
| FR-DSA.15 | Checkbox: indeterminate 상태 지원 |
| FR-DSA.16 | Switch: 접근성 aria-checked, role="switch" |
| FR-DSA.17 | Label: 필수 표시(*), optional 표시 |
| FR-DSA.18 | 모든 폼 요소 aria-invalid, aria-describedby 지원 |

| NFR | 비기능 |
|-----|-------|
| NFR-DSA.5 | 모든 폼 요소 키보드 100% 접근 |
| NFR-DSA.6 | 에러 메시지는 스크린리더에 announced |
