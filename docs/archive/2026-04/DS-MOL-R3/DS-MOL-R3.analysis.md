# DS-MOL-R3 — Gap Analysis

## matchRate

| Design 항목 | 산출물 | 상태 |
|------------|-------|------|
| Modal open/onClose + size 5종 + 백드롭/ESC | `molecules/Modal/index.tsx` | ✅ |
| Modal role=dialog + aria-modal + aria-labelledby | `molecules/Modal/index.tsx` | ✅ |
| Modal focus trap + 포커스 복귀 | `atoms/lib/useFocusTrap.ts` | ✅ |
| Modal header/body/footer slot | `molecules/Modal/index.tsx` | ✅ |
| Toast variant 4종 + duration auto-dismiss | `molecules/Toast/index.tsx` | ✅ |
| ToastProvider + useToast() 훅 + 큐 관리 | `molecules/Toast/index.tsx` | ✅ |
| Toast role=status (info/success/warning) / role=alert (error) | `molecules/Toast/index.tsx` | ✅ |
| Toast aria-live polite/assertive | `molecules/Toast/index.tsx` | ✅ |
| Drawer left/right side + size 3종 | `molecules/Drawer/index.tsx` | ✅ |
| Drawer role=dialog + ESC + 백드롭 | `molecules/Drawer/index.tsx` | ✅ |
| Drawer 슬라이드 인 애니메이션 (motion-safe) | `molecules/Drawer/index.tsx` | ✅ |
| useFocusTrap 공유 훅 | `atoms/lib/useFocusTrap.ts` | ✅ |

**matchRate: 100% (12/12)**

## 테스트

| 컴포넌트 | 테스트 수 |
|---------|---------|
| Modal | 11 ✅ |
| Toast | 8 ✅ |
| Drawer | 7 ✅ |
| **합계** | **26 ✅** |

## Q-Gate

| Gate | 결과 |
|------|-----|
| G1 FR ID | ✅ FR-DSM.21~23 (8개 하위) |
| G2 설계 완전성 | ✅ Modal/Toast/Drawer 전수 구현 |
| G3 코드 품질 | ✅ TypeScript strict, useFocusTrap 공유 |
| G4 커버리지 | ✅ 26/26 |
| G5 접근성 | ✅ aria-modal, aria-live, focus trap, ESC |
| G6 CSAP | ✅ 해당 없음 |
| G7 감사 로그 | ✅ |
