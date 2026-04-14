# DS-MOL-R3 — 분자 컴포넌트 3차 (Modal · Toast · Drawer)

> **Phase**: Design System Round 2 — Iteration 4
> **작성일**: 2026-04-14

## Executive Summary

| 관점 | 내용 |
|------|-----|
| 비즈니스 | 사용자 알림·확인·측면 패널 표준 — admin 작업 필수 분자 |
| 사용자 | 포커스 트랩, ESC 닫기, 스크린리더 안내, prefers-reduced-motion 존중 |
| 기술 | Native HTML <dialog>가 아닌 React 포털 + ARIA 직구현 (테스트 환경 호환) |
| 감리 | FR-DSM.21~23, WCAG 2.2 AA 키보드 트랩 |

## Context Anchor

- **WHY**: admin/감사 화면에서 확인 다이얼로그·삭제 경고·임시 알림이 핵심. 표준화 부재로 페이지마다 자체 구현 → 일관성 없음.
- **RISK**: 포털 사용 시 jsdom 환경 호환성. Portal 없이 inline absolute fixed 전략 채택.
- **SUCCESS**: 3개 컴포넌트 × 평균 7 테스트 = 21+, matchRate ≥ 95%
- **SCOPE**:
  - 포함: Modal (header/body/footer slot, size, ESC, backdrop click, focus trap), Toast (variant, auto-dismiss, queue, ToastProvider), Drawer (좌/우 측면 패널, 동일 패턴)
  - 제외: Modal 내 nested modal, Toast 위치 커스터마이징(상단 우측 고정), Drawer 리사이즈 핸들

## 기능 요구사항

| FR ID | 요구사항 |
|-------|---------|
| FR-DSM.21 | Modal: open/onClose, title, size (sm/md/lg/xl), 백드롭 클릭 닫기, ESC 닫기 |
| FR-DSM.21.1 | Modal: header/body/footer slot 또는 자식 직접, role="dialog" + aria-modal + aria-labelledby |
| FR-DSM.21.2 | Modal: 포커스 트랩 (Tab/Shift+Tab 순환), 열림 시 첫 포커서블에 포커스, 닫힘 시 트리거 복귀 |
| FR-DSM.22 | Toast: variant (info/success/warning/error), title, description, auto-dismiss (default 5s) |
| FR-DSM.22.1 | ToastProvider + useToast() 훅: 큐 관리, 동시 다수 표시 (스택), 닫기 버튼 |
| FR-DSM.22.2 | Toast role="status" / role="alert" (variant=error), aria-live=polite/assertive |
| FR-DSM.23 | Drawer: open/onClose, side (left/right), size, 동일 backdrop/ESC 동작 |
| FR-DSM.23.1 | Drawer: role="dialog" + aria-modal, 슬라이드 인 애니메이션 (motion-safe) |

## 비기능

- NFR-DSM.5: 21개+ 테스트, TypeScript strict
- NFR-DSM.6: 모든 토큰 사용, 하드코딩 금지

## 성공 기준

- [ ] Modal + 8 테스트
- [ ] Toast + ToastProvider + 7 테스트
- [ ] Drawer + 6 테스트
- [ ] export 갱신
- [ ] Q-Gate G1~G7 통과
