# DS-ATOM-R2 Design — 폼 원자 컴포넌트

> Plan Ref: DS-ATOM-R2.plan.md

## Design Decisions

### 결정 1: Controlled + Uncontrolled 모두 지원
value/defaultValue 둘 다 허용. ref 전달 필수.

### 결정 2: 에러 상태는 스타일 + ARIA 동시 처리
- 시각: `border-error`, `ring-error`
- ARIA: `aria-invalid="true"`, `aria-describedby={errorId}`
- 에러 메시지: `role="alert"` + `aria-live="polite"`

### 결정 3: Checkbox/Switch는 네이티브 입력 + 시각 래퍼
Radix 대신 네이티브 input + peer-checked 사용 (의존성 최소화, SSR 안정).

## 컴포넌트 명세

### Input
```typescript
type InputProps = {
  type?: 'text'|'email'|'password'|'number'|'search'|'tel'|'url'|'date'|'time';
  size?: 'sm'|'md'|'lg';
  error?: boolean | string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>;
```

### Textarea
```typescript
type TextareaProps = {
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  error?: boolean | string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;
```

### Checkbox
```typescript
type CheckboxProps = {
  indeterminate?: boolean;
  label?: ReactNode;
  error?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'|'size'>;
```

### Switch
```typescript
type SwitchProps = {
  label?: ReactNode;
  size?: 'sm'|'md'|'lg';
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'|'size'>;
```

### Label
```typescript
type LabelProps = {
  required?: boolean;  // * 표시
  optional?: boolean;  // (선택) 표시
} & LabelHTMLAttributes<HTMLLabelElement>;
```

## 파일 구조
```
atoms/
├── Input/index.tsx + Input.variants.ts + Input.test.tsx
├── Textarea/index.tsx + Textarea.test.tsx
├── Checkbox/index.tsx + Checkbox.test.tsx
├── Switch/index.tsx + Switch.test.tsx
└── Label/index.tsx + Label.test.tsx
```
