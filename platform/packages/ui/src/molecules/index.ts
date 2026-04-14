/**
 * DS-MOL-R1 + R2 + R3 + R4 — molecules 통합 export
 *
 * 구현:
 *  R1: FormField, Alert, Card (compound)
 *  R2: DataTable, StatusCard, SearchBar
 *  R3: Modal, Toast/ToastProvider, Drawer
 *  R4: DatePicker + formatKoreanDate
 */

export { FormField, type FormFieldProps } from './FormField/index.js';
export { Alert, type AlertProps } from './Alert/index.js';
export { alertVariants, type AlertVariant } from './Alert/Alert.variants.js';
export { Card, type CardProps } from './Card/index.js';

// ─────────── R2: 데이터/표시/검색 ───────────
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type DataTablePagination,
  type DataTableSelection,
} from './DataTable/index.js';
export {
  StatusCard,
  type StatusCardProps,
  type StatusCardVariant,
  type StatusCardTrend,
  type StatusCardTrendDirection,
} from './StatusCard/index.js';
export { SearchBar, type SearchBarProps } from './SearchBar/index.js';

// ─────────── R3: 오버레이 ───────────
export { Modal, type ModalProps, type ModalSize } from './Modal/index.js';
export {
  ToastProvider,
  useToast,
  type ToastProviderProps,
  type ToastContextValue,
  type ToastOptions,
  type ToastItem,
  type ToastVariant,
} from './Toast/index.js';
export {
  Drawer,
  type DrawerProps,
  type DrawerSide,
  type DrawerSize,
} from './Drawer/index.js';

// ─────────── R4: 날짜 입력 ───────────
export {
  DatePicker,
  formatKoreanDate,
  type DatePickerProps,
} from './DatePicker/index.js';
