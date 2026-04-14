# DS-ATOM-R4 — Typography 시스템

> **Phase**: Design System Round 2 — Iteration 2
> **작성일**: 2026-04-14
> **작성자**: PM Lead + frontend-architect

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| **비즈니스** | 공공기관 한국어 가독성 최우선 타이포그래피 — Heading/Body/Caption/Label/Code 5종 |
| **사용자** | Pretendard 폰트 + fluid clamp() 반응형, WCAG 2.2 명도 대비 준수 |
| **기술** | 기존 `--font-size-*` 토큰(이미 clamp() 적용) + `--font-sans` (Pretendard) 재사용 |
| **감리** | FR-DSA.31~35 — 5개 컴포넌트, 단일 API 표준화, 색상/weight 토큰만 사용 |

---

## Context Anchor

- **WHY**: atoms 컴포넌트(Button, Input, Label 등)는 텍스트를 내부에 임베드하지만, **독립 Heading/Body** 등은 페이지 레벨에서 반복 사용. 모든 화면에서 `<h1 class="...">`를 수작업 스타일링하는 것은 일관성 파괴.
- **WHO**: 포털 개발자, 감사 대시보드 작성자, admin 페이지 개발자
- **RISK**: 기존 base 토큰이 이미 fluid clamp를 포함 — 중복 정의 금지. 단순 컴포넌트 래퍼로 구현.
- **SUCCESS**: 5개 컴포넌트 × 평균 4 테스트 = 20개+ 테스트, 한국어 정렬·자간 최적화
- **SCOPE**:
  - 포함: Heading (level 1~6), Text (body/caption/label), Code (inline/block)
  - 제외: Prose(마크다운 전체 렌더), 리치텍스트 에디터

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| **FR-DSA.31** | Heading: `level: 1~6`, `as` prop으로 실제 태그 오버라이드, weight 선택 | MUST |
| **FR-DSA.32** | Text: `size` (xs/sm/base/lg/xl), `weight`, `variant` (body/caption/label/muted) | MUST |
| **FR-DSA.33** | Code: inline vs block, 고정폭 폰트 (mono), 구문 강조 없음 (별도 MTU) | MUST |
| **FR-DSA.34** | 모든 타이포그래피: Pretendard 기본, CSS 토큰만 사용 | MUST |
| **FR-DSA.35** | 접근성: 의미론적 태그(h1~h6) 유지, `as` 사용 시에도 aria-level 자동 | MUST |

## 비기능 요구사항

| NFR | 요구사항 |
|-----|---------|
| NFR-DSA.8 | 번들 추가분 < 2KB (단순 컴포넌트) |
| NFR-DSA.9 | TypeScript strict, `any` 금지 |
| NFR-DSA.10 | 단위 테스트 20개+ |

---

## 성공 기준

- [ ] Heading (level 1~6, as override, weight) + 5 테스트
- [ ] Text (size × weight × variant) + 6 테스트
- [ ] Code (inline/block) + 4 테스트
- [ ] `--font-mono` 토큰 확인 또는 추가
- [ ] atoms/index.ts + src/index.ts export
- [ ] matchRate ≥ 95%
- [ ] Q-Gate G1~G7 통과

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|-----|-----|-----|-------|
| 1.0.0 | 2026-04-14 | 초안 작성 | PM Lead |
