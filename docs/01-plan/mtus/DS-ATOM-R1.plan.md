# DS-ATOM-R1 Plan — 원자 컴포넌트 1차 (Button/Badge/Spinner/Icon)

> 작성일: 2026-04-11 | 작성자: PM Lead
> 의존: DS-TOKEN-R1 (완료)
> 다음: DS-ATOM-R2 (Input/Select/Checkbox)

## Executive Summary

| 관점 | 항목 | 목표 |
|------|------|------|
| 비즈니스 | 재사용 컴포넌트 | 4개 핵심 원자 |
| 사용자 | 접근성 | WCAG 2.2 AA + 키보드 탐색 |
| 기술 | 변형 관리 | CVA (class-variance-authority) 패턴 |
| 운영 | 테스트 커버리지 | 80%+ (Vitest + Testing Library) |

## Context Anchor

- **WHY**: DS-TOKEN-R1으로 토큰 인프라 완성. 이제 토큰을 소비하는 원자 컴포넌트 필요. 모든 분자/유기체의 빌딩블록.
- **WHO**: 35개 MTU의 모든 React 화면 개발자
- **RISK**: variant API 잘못 설계 시 추후 모든 컴포넌트 재작성. CVA 패턴 미정착 시 일관성 실패.
- **SUCCESS**:
  - SC-1: Button — 5 variant × 3 size, loading/disabled 상태, 키보드 포커스
  - SC-2: Badge — 6 variant (default/primary/success/warning/error/info)
  - SC-3: Spinner — 3 size, aria-label, prefers-reduced-motion 존중
  - SC-4: Icon — Lucide 래핑 + size 토큰
  - SC-5: cn() 유틸 + cva variants 패턴 표준화
- **SCOPE**:
  - In: cn util, cva variants, Button, Badge, Spinner, Icon, 단위 테스트
  - Out: Input/Select/Checkbox (DS-ATOM-R2), Storybook (이후)

## 요구사항 (FR)

| FR ID | 요구사항 |
|-------|---------|
| FR-DSA.1 | `lib/cn.ts` — clsx + tailwind-merge 래퍼 |
| FR-DSA.2 | `lib/cva.ts` — class-variance-authority 재export 헬퍼 |
| FR-DSA.3 | `Button` — variant: primary/secondary/ghost/danger/link, size: sm/md/lg |
| FR-DSA.4 | `Button` — loading prop (Spinner 통합), disabled, asChild (Slot) |
| FR-DSA.5 | `Badge` — variant 6종, dot 옵션 |
| FR-DSA.6 | `Spinner` — size sm/md/lg, aria-label="로딩 중" 기본값 |
| FR-DSA.7 | `Icon` — Lucide React 래핑, size 토큰 사용 |
| FR-DSA.8 | 모든 컴포넌트 forwardRef 지원 |
| FR-DSA.9 | 모든 컴포넌트 displayName 설정 |
| FR-DSA.10 | atoms/types.ts 업데이트 (실제 props 타입) |
| FR-DSA.11 | atoms/index.ts 통합 export |

| NFR ID | 비기능 |
|--------|-------|
| NFR-DSA.1 | TypeScript strict, any 금지 |
| NFR-DSA.2 | 모든 컴포넌트 키보드 접근 가능 (Tab, Enter, Space) |
| NFR-DSA.3 | aria-* 속성 적절히 설정 |
| NFR-DSA.4 | 컴포넌트 단위 테스트 80%+ |

## 추적성

| FR | 산출물 | 검증 |
|----|--------|------|
| FR-DSA.1 | atoms/lib/cn.ts | export 확인 |
| FR-DSA.2 | atoms/lib/cva.ts | export 확인 |
| FR-DSA.3~4 | atoms/Button/index.tsx + Button.test.tsx | 단위 테스트 |
| FR-DSA.5 | atoms/Badge/index.tsx + Badge.test.tsx | 단위 테스트 |
| FR-DSA.6 | atoms/Spinner/index.tsx | 단위 테스트 |
| FR-DSA.7 | atoms/Icon/index.tsx | 타입 검증 |
| FR-DSA.10~11 | atoms/types.ts, atoms/index.ts | 빌드 통과 |
