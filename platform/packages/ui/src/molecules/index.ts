/**
 * DS-MOL-R1 + R2 — molecules 통합 export
 *
 * 구현:
 *  R1: FormField, Alert, Card (compound)
 *  R2: DataTable, StatusCard, SearchBar
 *
 * 다음 (DS-MOL-R3): Modal, Toast, Drawer, ConfirmDialog
 * 다음 (DS-MOL-R4): DatePicker
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
