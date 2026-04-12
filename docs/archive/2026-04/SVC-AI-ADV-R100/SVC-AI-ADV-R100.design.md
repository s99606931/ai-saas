# SVC-AI-ADV-R100 — WCAG 2.2 Scanner Design

## 인터페이스

```typescript
export interface WcagViolation {
  rule: string;         // '2.4.11', '2.5.8' 등
  level: 'A' | 'AA' | 'AAA';
  message: string;
  snippet: string;
  suggestion: string;
}

export interface WcagReport {
  total: number;
  byLevel: Record<'A' | 'AA' | 'AAA', number>;
  violations: WcagViolation[];
}

export class Wcag22Scanner {
  scan(html: string): WcagViolation[];
  report(violations: WcagViolation[]): WcagReport;
}
```

## WCAG 2.2 신규 성공기준 (9개)

- 2.4.11 Focus Not Obscured (Minimum) — AA
- 2.4.12 Focus Not Obscured (Enhanced) — AAA
- 2.4.13 Focus Appearance — AAA
- 2.5.7 Dragging Movements — AA
- 2.5.8 Target Size (Minimum) — AA (24x24 CSS px)
- 3.2.6 Consistent Help — A
- 3.3.7 Redundant Entry — A
- 3.3.8 Accessible Authentication (Minimum) — AA
- 3.3.9 Accessible Authentication (Enhanced) — AAA

## 구현 규칙 (간소화 버전)

- 2.5.8: `<button>`/`<a>` 24px 미만 감지 (width/height inline style 검사)
- 3.2.6: `help`, `도움말` 링크 여러 페이지에 일관된 위치인지
- 3.3.7: form에 동일 필드 반복 여부

## 테스트

1. 2.5.8 작은 버튼 탐지
2. 3.3.7 반복 입력 탐지
3. 정상 HTML → 위반 0
4. report 집계
5. 심각도 필터
