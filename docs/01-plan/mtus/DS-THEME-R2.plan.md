# DS-THEME-R2 — 테마 프리셋 2차 (education · logistics)

> **Phase**: Design System Round 2 — Iteration 8
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 내용 |
|------|-----|
| 비즈니스 | 교육·물류 2개 섹터 전용 테마 추가 → 공공 SaaS 커버리지 확대 |
| 사용자 | 섹터별 브랜드 아이덴티티 반영 (교육=따뜻한 오렌지, 물류=냉철한 블루슬레이트) |
| 기술 | 기존 finance.css 패턴 재사용, base 색상 팔레트 확장 (amber/slate) |
| 감리 | FR-DST.11~12, 다크모드 지원 필수, a11yLevel AA 유지 |

## Context Anchor

- **WHY**: 기존 5개 테마(default/government/finance/healthcare/high-contrast)로는 교육·물류 기관 커스터마이징 부족. 실수요 기반 확장.
- **RISK**:
  - base.css에 amber, slate는 존재하나 orange 계열 없음 → amber 재사용
  - ThemeName union 타입 변경 → 사용처 타입 호환성 (자동 확장)
- **SUCCESS**: 2 테마 CSS + THEME_PRESETS 확장 + 테스트, matchRate ≥ 95%
- **SCOPE**:
  - 포함: education.css, logistics.css, themes/index.ts ThemeName 확장, index.css 임포트
  - 제외: 테마 스위처 UI 변경 (자동 반영됨), 추가 색상 팔레트 신규 정의

## 기능 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DST.11 | education 테마: 따뜻한 웜오렌지/앰버 기반, 학습 친화적 |
| FR-DST.11.1 | education: light + dark 모드 지원 |
| FR-DST.12 | logistics 테마: 냉철한 슬레이트블루, 산업/물류 신뢰감 |
| FR-DST.12.1 | logistics: light + dark 모드 지원 |
| FR-DST.13 | THEME_PRESETS 확장 + ThemeName union 타입 확장 |

## 성공 기준

- [ ] 2개 테마 CSS (education, logistics) + index.css 등록
- [ ] THEME_PRESETS 메타데이터 2개 추가
- [ ] 프리셋 수 테스트 (7개)
- [ ] Q-Gate 통과
