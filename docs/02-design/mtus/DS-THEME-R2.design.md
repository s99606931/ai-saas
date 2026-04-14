# DS-THEME-R2 — Design (education · logistics 테마)

## 결정

- 옵션 1: 기존 base.css 팔레트만 사용 **← 선택** (amber + slate + blue 재조합)
- 옵션 2: base.css에 새 팔레트(orange/indigo) 추가 — 현재 사용 범위에서 불필요
- 옵션 3: 테마별 하드코딩 HEX — 일관성 파괴

## education 테마

- **Primary**: amber-500 (#f59e0b 따뜻한 웜 앰버)
- **Secondary**: blue-600 (지식의 깊이)
- **Surface**: cream-warm (#fefdf8)
- **톤**: 친근하고 따뜻함, 학습 동기 부여

## logistics 테마

- **Primary**: slate-700 (#334155 냉철 슬레이트)
- **Secondary**: blue-600 (산업 청색)
- **Surface**: cool-white (#f8fafc)
- **톤**: 신뢰감·정확성, 운송 산업 아이덴티티

## 구현 방식

기존 `finance.css` 템플릿을 복제 → Primary/Secondary/Surface만 재정의.
base.css 신규 팔레트 정의는 **불필요** (기존 amber/slate/blue 활용).

## 메타데이터 (THEME_PRESETS)

```typescript
'education': {
  name: 'education',
  label: '교육',
  category: 'public',  // 기존 union 재사용
  previewColor: '#f59e0b',
  a11yLevel: 'AA',
  supportsDark: true,
  description: '따뜻한 앰버 — 학습 친화적 교육 기관',
},
'logistics': {
  name: 'logistics',
  label: '물류/운송',
  category: 'public',
  previewColor: '#334155',
  a11yLevel: 'AA',
  supportsDark: true,
  description: '냉철 슬레이트블루 — 산업/물류 신뢰감',
},
```

## 테스트 범위

- `THEME_PRESETS`가 7개 엔트리 (기존 5 + 신규 2)
- 각 신규 테마의 메타데이터 필수 필드(previewColor/a11yLevel/supportsDark) 존재
- `buildThemeClassName('education', 'dark')` → `'theme-education dark'`
