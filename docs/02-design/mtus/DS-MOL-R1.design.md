# DS-MOL-R1 Design — 분자 컴포넌트 1차

## Design Decisions

### 결정 1: FormField — children prop으로 Input 주입
사용자가 Input/Textarea/Checkbox 어떤 것이든 자유롭게 사용. FormField는 id/aria만 관리.

```tsx
<FormField label="이메일" required error="필수 입력">
  <Input type="email" />
</FormField>
```

내부적으로 cloneElement로 id/aria-* 주입.

### 결정 2: Alert — variant에 따라 아이콘 자동
Lucide 아이콘을 variant에 따라 매핑. 사용자는 icon prop으로 오버라이드 가능.

### 결정 3: Card — Compound Component 패턴
```tsx
<Card>
  <Card.Header>...</Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer>...</Card.Footer>
</Card>
```

## 파일 구조
```
molecules/
├── FormField/index.tsx + test
├── Alert/index.tsx + Alert.variants.ts + test
├── Card/index.tsx + test
└── index.ts
```
