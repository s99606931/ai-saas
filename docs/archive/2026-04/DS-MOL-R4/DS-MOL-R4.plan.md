# DS-MOL-R4 — 분자 컴포넌트 4차 (DatePicker)

> **Phase**: Design System Round 2 — Iteration 5
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 내용 |
|------|-----|
| 비즈니스 | 공공기관 문서의 표준 날짜 형식 `YYYY-MM-DD` 일원화 |
| 사용자 | 네이티브 `<input type="date">` + 커스텀 표시 + 한국어 placeholder |
| 기술 | 외부 캘린더 라이브러리 의존 없이 native input 우선 |
| 감리 | FR-DSM.31, WCAG 접근성 aria-required/invalid |

## Context Anchor

- **WHY**: 감사 대시보드·로그 필터에 날짜 입력 필수. 수작업 `<input type="text" placeholder="YYYY-MM-DD">`는 포맷 검증 부재 + 캘린더 미지원.
- **RISK**: 브라우저별 네이티브 date 위젯 스타일 차이 — placeholder 보이지 않음, 한국어 라벨 미지원 → visible 라벨 + input 조합으로 해결.
- **SUCCESS**: 1 컴포넌트 + 6~8 테스트, matchRate ≥ 95%
- **SCOPE**:
  - 포함: 단일 날짜 선택, min/max, 에러/헬퍼, value/onChange (YYYY-MM-DD string), required
  - 제외: 날짜 범위, 시간 포함, 다중 날짜

## 기능 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DSM.31 | DatePicker: value/onChange (YYYY-MM-DD), min/max, placeholder, error/helper |
| FR-DSM.31.1 | DatePicker: 네이티브 `<input type="date">` 기반, Input variants 재사용 |
| FR-DSM.31.2 | DatePicker: aria-invalid, aria-describedby, aria-required 연결 |
| FR-DSM.31.3 | formatKoreanDate 유틸: 2026-04-14 → "2026년 4월 14일" 변환 함수 독립 export |

## 성공 기준

- [ ] DatePicker + 6 테스트
- [ ] formatKoreanDate + 4 테스트
- [ ] export 갱신
- [ ] Q-Gate 통과
