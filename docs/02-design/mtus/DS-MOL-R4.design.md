# DS-MOL-R4 — Design (DatePicker)

## 결정

- 옵션 1: 커스텀 달력 (headlessui 스타일) — 복잡도 높음, R5로 연기
- 옵션 2: 네이티브 input[type=date] + Input 스타일 **← 선택**
- 옵션 3: dayjs/date-fns 의존 추가 — 번들 부담

## API

```typescript
interface DatePickerProps {
  value?: string;              // YYYY-MM-DD
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;                // YYYY-MM-DD
  max?: string;                // YYYY-MM-DD
  placeholder?: string;
  error?: boolean | string;
  helperText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}
```

## 구조

- 기반: Input 패턴 (inputVariants 재사용 + appearance-none)
- leading icon: Calendar (lucide-react)
- type="date" → 브라우저가 자체 달력 UI 제공
- 값 형식 검증: `value` string은 반드시 `YYYY-MM-DD` (ISO date)

## 유틸: formatKoreanDate

```typescript
export function formatKoreanDate(iso: string): string {
  // "2026-04-14" → "2026년 4월 14일"
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${y}년 ${m}월 ${d}일`;
}
```

별도 export, 테스트 4개.

## 접근성

- `<input type="date">` 자체가 role=spinbutton 또는 role=textbox (브라우저별)
- 추가 ARIA: aria-invalid, aria-describedby, aria-required
- 필수 라벨: 외부 FormField/Label과 결합 권장
