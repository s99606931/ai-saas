# DS-MOL-R2 — Design (DataTable · StatusCard · SearchBar)

> **Plan**: `docs/01-plan/mtus/DS-MOL-R2.plan.md`
> 작성: 2026-04-14

## 1. DataTable

### API

```typescript
interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor?: (row: T) => unknown;     // 커스텀 값 추출
  render?: (value: unknown, row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: keyof T | ((row: T) => string);   // 필수 — React key
  loading?: boolean;
  emptyMessage?: ReactNode;                 // 빈 상태
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  selection?: {
    mode: 'single' | 'multi';
    selectedKeys: string[];
    onSelectionChange: (keys: string[]) => void;
  };
  className?: string;
  'aria-label'?: string;
}
```

### 구조

- `<table role="table">`: semantic table
- `<thead><tr>` with `<th scope="col" aria-sort="...">`
- sortable header: 버튼 style + `aria-sort="ascending|descending|none"`, 클릭 시 onSort 호출
- `<tbody>`: data.map → `<tr>` → `<td>` (accessor/render 적용)
- selection: 첫 번째 컬럼에 Checkbox (multi) 또는 Radio (single)
- loading: `<tbody>` 대체로 스켈레톤 행 5개
- empty: data=[] 시 colSpan=all인 단일 행에 emptyMessage
- pagination footer: 이전/다음 버튼 + `페이지 X / Y` 표시

### 파일

```
molecules/DataTable/
  index.tsx        — DataTable + DataTablePagination 내부
  DataTable.test.tsx
```

## 2. StatusCard

### API

```typescript
type StatusCardVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface StatusCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;                  // 예: 12.5 (%)
    direction: 'up' | 'down' | 'neutral';
    label?: string;                 // 예: "전월 대비"
  };
  description?: ReactNode;
  variant?: StatusCardVariant;
  className?: string;
}
```

### 구조

- 기반: Card 재사용 (variant에 따라 left border 색상 강조)
- 레이아웃:
  ```
  [아이콘] [제목]             [트렌드 뱃지]
           [value (큰 숫자)]
           [description]
  ```
- trend 화살표: ↑ (up) / ↓ (down) / → (neutral)
- variant 색상:
  - default: 서피스
  - success: `--color-success`
  - warning: `--color-warning`
  - error: `--color-error`
  - info: `--color-primary`

## 3. SearchBar

### API

```typescript
interface SearchBarProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;    // 디바운스 후 발화
  onClear?: () => void;
  placeholder?: string;
  debounceMs?: number;                    // default 300
  recentSearches?: string[];
  onRecentSelect?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}
```

### 동작

- 내부 상태 `[text, setText]`
- `useEffect` 디바운스: text 변경 후 `debounceMs` 경과 시 `onSearch(text)` 호출
- 포커스 + recentSearches.length > 0 시 드롭다운 표시
- 각 recent 항목 클릭 → setText + onRecentSelect
- clear 버튼 (X 아이콘) → setText('') + onClear
- ESC 키 → clear
- `role="searchbox"` 지정 (native input + role 보조)

### 파일

```
molecules/SearchBar/
  index.tsx
  SearchBar.test.tsx
```

## Design Anchor

- **아키텍처**: 기존 atoms (Input, Button, Checkbox, Radio, Spinner, Card) 최대 재사용
- **Pragmatic Balance**: 가상화는 R3, 드래그 정렬은 별도 MTU
- **접근성 우선**: 테이블 semantic + aria-sort, searchbox role, 키보드 탐색

## 토큰 매핑

- 전체: Card 토큰 (--card-*), 상태 색상 (--color-success/warning/error/primary)
- DataTable: 경계선 --color-outline-variant, 호버 --color-surface-hover
