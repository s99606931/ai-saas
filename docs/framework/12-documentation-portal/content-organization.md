# 문서 포털 콘텐츠 구성 아키텍처

> MTU-A5 | FR-7.2 | 적용 기준일: 2026-04-05
> 참조: Docusaurus 3.x 사이드바 설정

---

## 1. 역할별 사이드바 구성

### 1.1 CTO/PM 사이드바

```typescript
const ctoSidebar = [
  { type: 'doc', id: '00-getting-started/README', label: '프레임워크 개요' },
  { type: 'category', label: '감리 현황', items: [
    '07-audit-compliance/audit-completion-checklist',
    '07-audit-compliance/templates/T04-traceability-matrix',
  ]},
  { type: 'category', label: 'CSAP 준수 현황', items: [
    '02-csap/standard-grade/checklist-master',
  ]},
  { type: 'category', label: 'ISMS-P 준수 현황', items: [
    '03-isms-p/management-controls/M01-M04-policy-org',
  ]},
]
```

### 1.2 개발자 사이드바

```typescript
const devSidebar = [
  { type: 'doc', id: '00-getting-started/quick-start', label: '빠른 시작' },
  { type: 'category', label: '개발 표준', items: [
    '01-dev-standards/coding-style-guide',
    '01-dev-standards/doc-type-templates',
    '01-dev-standards/requirement-id-system',
    '01-dev-standards/review-checklist',
  ]},
  { type: 'category', label: 'CSAP 구현 가이드', items: [
    '02-csap/standard-grade/implementation-guide/D08-access-control',
    '02-csap/standard-grade/implementation-guide/D09-encryption',
    '02-csap/standard-grade/implementation-guide/D12-system-dev-security',
  ]},
  { type: 'category', label: 'AI 연동', items: [
    '09-ai-integration/security-gateway-pattern',
    '09-ai-integration/data-classification-masking',
    '09-ai-integration/mcp-integration-guide',
    '09-ai-integration/lmstudio-guide',
  ]},
  { type: 'category', label: '인프라', items: [
    '08-infra/k3s-wsl2/cluster-setup-recipe',
    '08-infra/gitea-cicd-guide',
    '08-infra/flux-gitops-guide',
    '08-infra/harbor-registry-guide',
  ]},
]
```

### 1.3 감리관 사이드바

```typescript
const auditorSidebar = [
  { type: 'category', label: '감리 산출물', items: [
    '07-audit-compliance/templates/T01-business-plan',
    '07-audit-compliance/templates/T02-requirements',
    '07-audit-compliance/templates/T03-detailed-design',
    '07-audit-compliance/templates/T04-traceability-matrix',
    '07-audit-compliance/templates/T05-test-plan',
    '07-audit-compliance/templates/T06-test-result',
    '07-audit-compliance/templates/T07-defect-management',
  ]},
  { type: 'doc', id: '07-audit-compliance/audit-completion-checklist', label: '감리 완료 체크리스트' },
  { type: 'category', label: 'CSAP 체크리스트', items: [
    '02-csap/standard-grade/checklist-master',
    '02-csap/simple-grade/checklist-simple',
  ]},
]
```

### 1.4 보안 담당자 사이드바

```typescript
const securitySidebar = [
  { type: 'category', label: 'CSAP 79항목', items: [
    '02-csap/standard-grade/checklist-master',
    { type: 'category', label: '구현 가이드', items: [
      '02-csap/standard-grade/implementation-guide/D01-policy',
      '02-csap/standard-grade/implementation-guide/D08-access-control',
      '02-csap/standard-grade/implementation-guide/D09-encryption',
      '02-csap/standard-grade/implementation-guide/D10-network-security',
      '02-csap/standard-grade/implementation-guide/D11-virtualization-security',
      '02-csap/standard-grade/implementation-guide/D12-system-dev-security',
    ]},
  ]},
  { type: 'category', label: 'N2SF', items: [
    '04-n2sf/data-grade-classification',
    '04-n2sf/csap-n2sf-mapping',
    { type: 'category', label: 'N2SF 영역별', items: [
      '04-n2sf/domains/N01-management-security',
      '04-n2sf/domains/N02-authentication',
      '04-n2sf/domains/N03-isolation',
      '04-n2sf/domains/N04-encryption',
      '04-n2sf/domains/N05-data',
      '04-n2sf/domains/N06-operations',
    ]},
  ]},
  { type: 'category', label: 'ISMS-P', items: [
    { type: 'category', label: '관리체계', items: [
      '03-isms-p/management-controls/M01-M04-policy-org',
      '03-isms-p/management-controls/M05-M08-risk',
      '03-isms-p/management-controls/M09-M12-operation',
      '03-isms-p/management-controls/M13-M16-improvement',
    ]},
    { type: 'category', label: '보호대책', items: [
      '03-isms-p/protection-controls/P01-P14-access',
      '03-isms-p/protection-controls/P15-P29-crypto',
      '03-isms-p/protection-controls/P30-P44-network',
      '03-isms-p/protection-controls/P45-P64-operation',
    ]},
    { type: 'category', label: '개인정보', items: [
      '03-isms-p/privacy-controls/I01-I07-collection',
      '03-isms-p/privacy-controls/I08-I14-processing',
      '03-isms-p/privacy-controls/I15-I21-disposal',
    ]},
  ]},
  { type: 'doc', id: '99-references/oscal/oscal-mapping-guide', label: 'OSCAL 매핑' },
]
```

### 1.5 PM 사이드바

```typescript
const pmSidebar = [
  { type: 'doc', id: '00-getting-started/README', label: '프레임워크 개요' },
  { type: 'category', label: '감리 산출물', items: [
    '05-audit-docs/T01-business-plan',
    '05-audit-docs/T02-requirements',
  ]},
  { type: 'doc', id: '99-references/regulations-index', label: '규정 인덱스' },
  { type: 'doc', id: '99-references/glossary-and-acronyms', label: '용어 사전' },
]
```

---

## 2. CSAP 체크리스트 MDX 인터랙티브 뷰어

### 2.1 컴포넌트 (CsapChecklist.tsx)

```tsx
import React, { useState, useMemo } from 'react'

interface ChecklistItem {
  id: string       // CSAP-D08-01
  title: string
  domain: string   // D-08
  status: 'done' | 'in-progress' | 'todo'
  evidence?: string
  ismsPMapping?: string
}

interface Props {
  items: ChecklistItem[]
}

export function CsapChecklist({ items }: Props) {
  const [filter, setFilter] = useState<string>('all')
  const [domainFilter, setDomainFilter] = useState<string>('all')

  const domains = useMemo(() => {
    const set = new Set(items.map(i => i.domain))
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    let result = items
    if (filter !== 'all') result = result.filter(i => i.status === filter)
    if (domainFilter !== 'all') result = result.filter(i => i.domain === domainFilter)
    return result
  }, [items, filter, domainFilter])

  const stats = useMemo(() => ({
    done: items.filter(i => i.status === 'done').length,
    inProgress: items.filter(i => i.status === 'in-progress').length,
    todo: items.filter(i => i.status === 'todo').length,
  }), [items])

  const completionRate = Math.round((stats.done / items.length) * 100)

  return (
    <div className="csap-checklist">
      <div className="stats-bar">
        <span className="stat done">{stats.done} 완료</span>
        <span className="stat in-progress">{stats.inProgress} 진행 중</span>
        <span className="stat todo">{stats.todo} 미착수</span>
        <span className="stat total">
          완료율: {completionRate}% ({stats.done}/{items.length})
        </span>
      </div>

      <div className="filters">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="done">완료</option>
          <option value="in-progress">진행 중</option>
          <option value="todo">미착수</option>
        </select>
        <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
          <option value="all">전체 분야</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <table className="checklist-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>항목명</th>
            <th>분야</th>
            <th>상태</th>
            <th>ISMS-P</th>
            <th>증적</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(item => (
            <tr key={item.id} className={`status-${item.status}`}>
              <td><code>{item.id}</code></td>
              <td>{item.title}</td>
              <td>{item.domain}</td>
              <td>
                <span className={`badge badge-${item.status}`}>
                  {item.status === 'done' ? '완료' :
                   item.status === 'in-progress' ? '진행 중' : '미착수'}
                </span>
              </td>
              <td>{item.ismsPMapping || '—'}</td>
              <td>{item.evidence ? <a href={item.evidence}>보기</a> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 2.2 MDX 사용 예시

```mdx
---
title: CSAP D-08 접근 통제 현황
---

import { CsapChecklist } from '@site/src/components/CsapChecklist'

# CSAP D-08 접근 통제 현황

<CsapChecklist items={[
  { id: 'CSAP-D08-01', title: '사용자 계정 관리 정책', domain: 'D-08',
    status: 'done', ismsPMapping: 'ISMS-P-P-01',
    evidence: '/audit/evidence/d08-01.pdf' },
  { id: 'CSAP-D08-02', title: '사용자 등록 삭제 절차', domain: 'D-08',
    status: 'done', ismsPMapping: 'ISMS-P-P-02' },
  { id: 'CSAP-D08-03', title: '인증 수단', domain: 'D-08',
    status: 'in-progress', ismsPMapping: 'ISMS-P-P-03' },
]} />
```

---

## 3. 검색 기능 설정

```typescript
// docusaurus.config.ts 내 search-local 상세 설정
{
  hashed: true,
  language: ['ko', 'en'],
  indexDocs: true,
  indexBlog: false,
  docsRouteBasePath: '/docs',
  highlightSearchTermsOnTargetPage: true,
  searchResultLimits: 10,
  searchResultContextMaxLength: 80,
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A5 Do — 콘텐츠 구성 + MDX 인터랙티브 뷰어 작성 | Implementer Agent |
