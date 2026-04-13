# DS-ATOM-R3 — 원자 컴포넌트 3차 (Select · Radio · Avatar · Tooltip)

> **Phase**: Design System Round 2 — Iteration 1
> **작성일**: 2026-04-11
> **작성자**: PM Lead + frontend-architect
> **근거 문서**: CLAUDE.md §3 (문서 형식 기준)

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| **비즈니스** | 공공기관 업무 화면의 핵심 입력·표시 요소(Select/Radio/Avatar/Tooltip) 표준화로 화면 간 일관성 확보, 재사용률 70% 목표 |
| **사용자** | WCAG 2.2 AA / KWCAG 2.2 준수 — 키보드만으로도 모든 조작 가능, 스크린리더 한국어 안내 정확 |
| **기술** | CVA + CSS 토큰 기반, 네이티브 HTML 원소 + ARIA 완전 지원, Radix 의존 없이 zero-runtime-deps 구현 |
| **감리** | FR-DSA.21~24 신설, NFR-DSA.4 커버리지 80% 이상, CSAP D-08 접근통제 / D-12 개발보안 기여 |

---

## Context Anchor

- **WHY**: 이전 세션(DS-ATOM-R1/R2)에서 Button·Badge·Input·Checkbox 등 9개 원자가 완성되었으나, 폼 화면에서 필수인 **Select**·**Radio**·**Avatar**·**Tooltip**이 누락되어 molecules·organisms 진행의 병목이 발생. 특히 FormField가 Select를 children으로 받는 설계지만 실제 Select 컴포넌트가 없음.
- **WHO**: 포털 개발자(내부), 디자인시스템 소비자(감사대시보드/admin 페이지), 감리 대응 개발팀
- **RISK**: Radix UI 미설치(peer dep 부재) 상태에서 Radix 기반 구현 시 빌드 실패 → **native HTML + ARIA 직구현**으로 결정
- **SUCCESS**:
  - 4개 컴포넌트 × 평균 6개 단위 테스트 = 24개+ 테스트 추가
  - matchRate ≥ 95%, Q-Gate G1~G7 전수 통과
  - `packages/ui/src/index.ts`에서 단일 import로 전체 노출
- **SCOPE**:
  - 포함: Select(네이티브), RadioGroup+Radio, Avatar(이미지+이니셜 폴백), Tooltip(키보드 포커스 지원)
  - 제외: 가상 리스트 Select, 다중 선택 Select, 아바타 그룹 overlay, Tooltip 화살표(추후 R4)

---

## 기능 요구사항 (Functional Requirements)

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| **FR-DSA.21** | Select: 네이티브 `<select>` 기반 단일 선택, size (sm/md/lg), error/helper 지원, leadingIcon 지원 | MUST |
| **FR-DSA.21.1** | Select: `options: {label, value, disabled?}[]` 배열 + `placeholder` + `value/defaultValue`/`onChange` | MUST |
| **FR-DSA.21.2** | Select: `aria-invalid` / `aria-describedby` / `aria-required` 자동 연결 | MUST |
| **FR-DSA.22** | Radio: 단일 라디오 버튼 (네이티브 `<input type="radio">`) + 라벨 inline 표시 | MUST |
| **FR-DSA.22.1** | RadioGroup: `value/onChange/name`, children `<Radio>` 자동 그룹화, 방향(row/column) 지원 | MUST |
| **FR-DSA.22.2** | RadioGroup: `role="radiogroup"` + `aria-required` + 키보드(화살표) 탐색 네이티브 위임 | MUST |
| **FR-DSA.23** | Avatar: 이미지 렌더링, 실패 시 이니셜(한글 첫 글자 또는 영문 2자) 폴백 | MUST |
| **FR-DSA.23.1** | Avatar: size (xs/sm/md/lg/xl) 5단계, shape (circle/square), status 인디케이터(online/offline/busy) | MUST |
| **FR-DSA.23.2** | Avatar: `alt` 필수, 이니셜 폴백 시 `aria-label` 자동 연결 | MUST |
| **FR-DSA.24** | Tooltip: 포커스/마우스 호버 시 표시, ESC 로 닫기, 포커스 이탈 시 닫기 | MUST |
| **FR-DSA.24.1** | Tooltip: `side` (top/right/bottom/left), `delay` (ms), `disabled` prop | MUST |
| **FR-DSA.24.2** | Tooltip: `role="tooltip"` + `aria-describedby` 자동 연결, 애니메이션 `prefers-reduced-motion` 존중 | MUST |

## 비기능 요구사항

| NFR ID | 요구사항 |
|--------|---------|
| **NFR-DSA.4** | 단위 테스트 커버리지 80% 이상, 4개 컴포넌트 각 5개+ 테스트 |
| **NFR-DSA.5** | TypeScript strict, `any` 금지 (`unknown` + 제네릭 사용) |
| **NFR-DSA.6** | 번들 추가분 < 3KB gzip (native HTML 기반이므로) |
| **NFR-DSA.7** | 모든 스타일 CSS 토큰만 사용 — 색상·간격 하드코딩 금지 |

---

## 성공 기준 (Success Criteria)

- [x] Plan + Design 문서 작성 완료
- [ ] `atoms/Select/index.tsx` + variants + test — 6개+ 테스트
- [ ] `atoms/Radio/index.tsx` + test (Radio + RadioGroup 포함) — 6개+ 테스트
- [ ] `atoms/Avatar/index.tsx` + variants + test — 6개+ 테스트
- [ ] `atoms/Tooltip/index.tsx` + test — 5개+ 테스트
- [ ] `atoms/index.ts` export 추가
- [ ] `src/index.ts` 루트 export 업데이트
- [ ] matchRate ≥ 95%
- [ ] Q-Gate G1 (FR ID), G3 (품질), G4 (커버리지), G5 (접근성) 통과

---

## 추적성 매트릭스 (FR ↔ 산출물 ↔ 테스트 ↔ CSAP)

| FR | 산출물 | 테스트 | CSAP |
|----|-------|-------|------|
| FR-DSA.21 | `atoms/Select/index.tsx` | `Select.test.tsx` | D-08 접근통제 (키보드) |
| FR-DSA.22 | `atoms/Radio/index.tsx` | `Radio.test.tsx` | D-12 입력검증 (단일선택) |
| FR-DSA.23 | `atoms/Avatar/index.tsx` | `Avatar.test.tsx` | D-08 (프로필 표시) |
| FR-DSA.24 | `atoms/Tooltip/index.tsx` | `Tooltip.test.tsx` | D-12 (도움말 안내) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|-----|-----|-----|-------|
| 1.0.0 | 2026-04-11 | 초안 작성 (DS Round 2 iteration 1) | PM Lead |
