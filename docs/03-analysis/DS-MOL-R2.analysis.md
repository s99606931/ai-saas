# DS-MOL-R2 — Gap Analysis

## matchRate

| Design 항목 | 산출물 | 상태 |
|------------|-------|------|
| DataTable 제네릭 `<T>` + columns API | `molecules/DataTable/index.tsx` | ✅ |
| DataTable 정렬 (header 버튼 + aria-sort) | `molecules/DataTable/index.tsx` | ✅ |
| DataTable 페이지네이션 (이전/다음/표시) | `molecules/DataTable/index.tsx` | ✅ |
| DataTable 행 선택 single/multi + 전체선택 | `molecules/DataTable/index.tsx` | ✅ |
| DataTable loading + 빈 상태 | `molecules/DataTable/index.tsx` | ✅ |
| DataTable semantic <table> + scope="col" | `molecules/DataTable/index.tsx` | ✅ |
| StatusCard 제목 + 수치 + 아이콘 + 트렌드 | `molecules/StatusCard/index.tsx` | ✅ |
| StatusCard variant 5종 (default/success/warning/error/info) | `molecules/StatusCard/index.tsx` | ✅ |
| StatusCard trend direction 3종 (up/down/neutral) | `molecules/StatusCard/index.tsx` | ✅ |
| SearchBar 디바운스 onSearch | `molecules/SearchBar/index.tsx` | ✅ |
| SearchBar 클리어 버튼 + ESC 단축키 | `molecules/SearchBar/index.tsx` | ✅ |
| SearchBar 최근 검색 listbox | `molecules/SearchBar/index.tsx` | ✅ |
| SearchBar role="searchbox" + aria-expanded | `molecules/SearchBar/index.tsx` | ✅ |

**matchRate: 100% (13/13)**

## 테스트

| 컴포넌트 | 테스트 수 |
|---------|---------|
| DataTable | 12 ✅ |
| StatusCard | 7 ✅ |
| SearchBar | 9 ✅ |
| **합계** | **28 ✅** |

## Q-Gate

| Gate | 결과 |
|------|-----|
| G1 FR ID | ✅ FR-DSM.11~13 (9개 하위) |
| G2 설계 완전성 | ✅ |
| G3 코드 품질 | ✅ TypeScript strict + 제네릭 타입 안전 |
| G4 커버리지 | ✅ 28/28 |
| G5 접근성 | ✅ aria-sort, aria-expanded, role="searchbox"/"listbox" |
| G6 CSAP | ✅ 해당 없음 |
| G7 감사 로그 | ✅ |
