# DS-ORG-R2 — Design (PageHeader · FilterBar · EmptyState)

## 결정

- 옵션 1: children slot 기반 유연 설계 **← 선택**
- 옵션 2: 선언적 schema (필드 배열 전달) — 복잡도 증가, DS-ORG-R3로 연기
- 옵션 3: compound component 패턴 — overkill

## PageHeader 구조

```
┌──────────────────────────────────────────────┐
│ [Breadcrumbs]                                │
│ Title                              [Actions] │
│ Subtitle                                     │
└──────────────────────────────────────────────┘
```

## API

```typescript
// PageHeader
interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  actions?: ReactNode;
  as?: 'h1' | 'h2';  // default h1
  className?: string;
}

// FilterBar
interface FilterBarProps {
  children: ReactNode;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  resetLabel?: string;  // default "초기화"
  className?: string;
  'aria-label'?: string;
}

// EmptyState
type EmptyStateVariant = 'default' | 'search' | 'forbidden' | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;  // default 'default'
  icon?: ReactNode;  // 없으면 variant 기본 아이콘
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}
```

## variant 매핑 (EmptyState)

| variant | 기본 아이콘 | role | 색상 |
|---------|------------|------|------|
| default | Inbox | status | muted |
| search | Search | status | muted |
| forbidden | Lock | alert | warning |
| error | AlertCircle | alert | error |

## 접근성

- PageHeader: title은 h1(또는 h2). breadcrumbs는 `nav aria-label="경로"`.
- FilterBar: section aria-label. reset 버튼 명시적 label.
- EmptyState: role + 기본 아이콘 decorative(aria-hidden).

## 테스트 범위

- PageHeader: 제목/부제/브레드크럼/액션 슬롯, as prop, h2 전환
- FilterBar: children 렌더, reset 호출, hasActiveFilters 표시
- EmptyState: 4 variant 아이콘·role, action 클릭
