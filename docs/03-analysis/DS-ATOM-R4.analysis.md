# DS-ATOM-R4 — Gap Analysis

## matchRate

| Design 항목 | 산출물 | 상태 |
|------------|-------|------|
| Heading level 1~6 + as override + aria-level | `atoms/Heading/index.tsx` | ✅ |
| Heading weight (regular/medium/semibold/bold) + truncate | `atoms/Heading/index.tsx` | ✅ |
| Text size × weight × variant (body/caption/label/muted/error) | `atoms/Text/index.tsx` | ✅ |
| Text as override (p/span/div/strong/em/small) | `atoms/Text/index.tsx` | ✅ |
| Code inline + block 모드 | `atoms/Code/index.tsx` | ✅ |
| Code mono 폰트 (--font-mono) + 서피스 배경 | `atoms/Code/index.tsx` | ✅ |
| 모든 컴포넌트 --font-sans (Pretendard) 적용 | 전체 | ✅ |
| CSS 토큰만 사용 (하드코딩 금지) | 전체 | ✅ |

**matchRate: 100% (8/8)**

## 테스트 커버리지

| 컴포넌트 | 테스트 수 |
|---------|---------|
| Heading | 7 ✅ |
| Text | 8 ✅ |
| Code | 6 ✅ |
| **합계** | **21 ✅** |

## Q-Gate

| Gate | 결과 |
|------|-----|
| G1 FR ID | ✅ FR-DSA.31~35 |
| G2 설계 완전성 | ✅ |
| G3 코드 품질 | ✅ TypeScript strict, any 0개 |
| G4 커버리지 80%+ | ✅ 21/21 |
| G5 접근성 | ✅ aria-level 유지, 의미론적 태그 |
| G6 CSAP | ✅ 해당 없음 (타이포그래피 규제 영향 없음) |
| G7 감사 로그 | ✅ audit.jsonl 기록 |
