# MTU-A5: Docusaurus 문서 포털 [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A5 |
| Phase | Phase 4 Advanced |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-7.2 |
| 의존 MTU | MTU-F1, MTU-F2, MTU-F3, MTU-F4, MTU-F5, MTU-F6 (전체 기준 문서 완료 후) |
| 예상 세션 | 1 세션 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 68개 산출물 파일을 역할별로 탐색 가능한 통합 포털 제공 — 감리관·PM·개발자가 각자 필요한 문서를 즉시 찾을 수 있어야 감리 효율 극대화 |
| WHO | 모든 프로젝트 이해관계자 (CTO/PM/Dev/Auditor/Security) |
| RISK | MkDocs Material 2025-11 유지보수 모드 진입 — 장기 운영 시 보안 패치 중단 위험, Docusaurus로 전환 필수 |
| SUCCESS | k3s 내부 배포 + 역할별 사이드바 3개 이상 + CSAP 체크리스트 MDX 인터랙티브 뷰어 동작 |
| SCOPE | Docusaurus 설정 가이드 + 콘텐츠 구성 아키텍처 (실제 포털 구축은 구현 단계) |

---

## 목적

공공기관 SaaS 프레임워크의 68개 산출물 파일을 역할별로 탐색 가능한
Docusaurus 기반 문서 포털을 구성합니다.

**선택 근거 — MkDocs Material → Docusaurus 전환**:

| 항목 | MkDocs Material | Docusaurus 3.x |
|------|----------------|---------------|
| 유지보수 상태 | 2025-11 유지보수 모드 | 활성 개발 (Meta OSS) |
| MDX 지원 | 미지원 | 네이티브 지원 (React 컴포넌트 삽입) |
| 인터랙티브 컴포넌트 | 제한적 | CSAP 체크리스트 인터랙티브 뷰어 구현 가능 |
| 검색 | algolia/lunr | Algolia DocSearch + 로컬 검색 |
| k3s 배포 | 정적 파일 서빙 | 동일 (Nginx/Caddy) |
| 한국어 지원 | 기본 | i18n 플러그인 완전 지원 |

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `12-documentation-portal/docusaurus-setup-guide.md` | 구현 가이드형 | Docusaurus 설치, 설정, k3s 배포, 플러그인 구성 |
| `12-documentation-portal/content-organization.md` | 아키텍처 레퍼런스형 | 역할별 사이드바 구성, 콘텐츠 분류 체계, MDX 예시 |

---

## 포털 아키텍처 설계

### k3s 배포 구성

```
┌─────────────────────────────────────────────────────────┐
│  k3s 클러스터 (WSL2)                                      │
│                                                          │
│  ┌──────────────────────────────────┐                   │
│  │  Namespace: docs-portal           │                   │
│  │  ┌────────────────────────────┐  │                   │
│  │  │  Deployment: docusaurus    │  │                   │
│  │  │  Image: nginx:alpine       │  │                   │
│  │  │  Volume: /docs (정적 빌드) │  │                   │
│  │  └────────────────────────────┘  │                   │
│  │  Service: ClusterIP :3000         │                   │
│  │  Ingress: docs.internal           │                   │
│  └──────────────────────────────────┘                   │
│                                                          │
│  Gitea Actions → npm run build → k3s 자동 배포           │
└─────────────────────────────────────────────────────────┘
```

### 역할별 사이드바 구성 (최소 5개 역할)

```javascript
// docusaurus.config.js sidebars 설정 예시
const sidebars = {
  // 역할 1: CTO/PM — 경영진 대시보드
  ctoSidebar: [
    { type: 'doc', id: 'getting-started/executive-summary' },
    { type: 'doc', id: 'roadmap/master-roadmap' },
    { type: 'category', label: '감리 현황', items: ['audit/completion-checklist'] },
  ],

  // 역할 2: 개발자 — 구현 가이드 중심
  devSidebar: [
    { type: 'category', label: 'CSAP 구현', items: ['csap/d08-access-control', '...'] },
    { type: 'category', label: 'AI 연동', items: ['ai-integration/security-gateway', '...'] },
    { type: 'category', label: '인프라', items: ['infra/k3s-setup', '...'] },
  ],

  // 역할 3: 감리관 — 산출물 직접 접근
  auditorSidebar: [
    { type: 'category', label: '감리 산출물', items: [
      'audit/t01-business-plan',
      'audit/t02-requirements',
      'audit/t03-detailed-design',
      'audit/t04-traceability-matrix',
      'audit/t05-test-plan',
      'audit/t06-test-result',
      'audit/t07-defect-management',
    ]},
    { type: 'doc', id: 'audit/completion-checklist' },
  ],

  // 역할 4: 보안 담당자 — CSAP/N2SF/ISMS-P
  securitySidebar: [
    { type: 'category', label: 'CSAP 79항목', items: ['csap/master-checklist', '...'] },
    { type: 'category', label: 'N2SF 매핑', items: ['n2sf/data-classification', '...'] },
    { type: 'category', label: 'ISMS-P', items: ['isms-p/checklist-101', '...'] },
    { type: 'doc', id: 'oscal/mapping-guide' },
  ],

  // 역할 5: PM — 일정·계획 중심
  pmSidebar: [
    { type: 'doc', id: 'roadmap/master-roadmap' },
    { type: 'category', label: 'MTU 계획', items: ['plan/mtus/overview', '...'] },
    { type: 'category', label: '요구사항', items: ['audit/t02-requirements'] },
  ],
}
```

---

## CSAP 체크리스트 MDX 인터랙티브 뷰어 설계

MDX 컴포넌트 예시 (`CsapChecklist.tsx`):

```tsx
// src/components/CsapChecklist.tsx
import React, { useState } from 'react'

interface ChecklistItem {
  id: string       // CSAP-D08-01
  title: string
  status: 'done' | 'in-progress' | 'todo'
  evidence?: string
}

export function CsapChecklist({ items }: { items: ChecklistItem[] }) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)
  const doneCount = items.filter(i => i.status === 'done').length

  return (
    <div>
      <p>완료율: {doneCount}/{items.length} ({Math.round(doneCount/items.length*100)}%)</p>
      <select onChange={e => setFilter(e.target.value)}>
        <option value="all">전체</option>
        <option value="done">완료</option>
        <option value="in-progress">진행 중</option>
        <option value="todo">미착수</option>
      </select>
      {filtered.map(item => (
        <div key={item.id} className={`checklist-item status-${item.status}`}>
          <span className="item-id">{item.id}</span>
          <span className="item-title">{item.title}</span>
          {item.evidence && <a href={item.evidence}>증적 보기</a>}
        </div>
      ))}
    </div>
  )
}
```

MDX 페이지에서 사용:

```mdx
import { CsapChecklist } from '@site/src/components/CsapChecklist'

# CSAP D-08 접근 통제 현황

<CsapChecklist items={[
  { id: 'CSAP-D08-01', title: '사용자 계정 관리 정책', status: 'done', evidence: '/audit/evidence/d08-01.pdf' },
  { id: 'CSAP-D08-02', title: '권한 최소화 원칙', status: 'in-progress' },
  ...
]} />
```

---

## Docusaurus 플러그인 구성

| 플러그인 | 용도 | 설정 |
|---------|------|------|
| `@docusaurus/plugin-content-docs` | 문서 관리 (다중 인스턴스) | 역할별 사이드바 |
| `@docusaurus/plugin-search-local` | 오프라인 전문 검색 | 한국어 토크나이저 |
| `@docusaurus/plugin-sitemap` | 사이트맵 자동 생성 | — |
| `docusaurus-plugin-mermaid` | 아키텍처 다이어그램 렌더링 | Gitea 파이프라인 구성도 등 |
| `@docusaurus/theme-mermaid` | Mermaid 테마 | — |

---

## 합격 기준

1. Docusaurus k3s 배포 확인: `kubectl get pods -n docs-portal` 상태 Running + Ingress 응답 200
2. 역할별 사이드바 구성: CTO/Dev/Auditor/Security/PM 5개 역할 사이드바 완비 (최소 3개 필수)
3. CSAP 체크리스트 MDX 인터랙티브 뷰어: `CsapChecklist` 컴포넌트 예시 코드 완비 + MDX 사용 예시 포함
4. 검색 기능 동작: `@docusaurus/plugin-search-local` 설정 완비, 한국어 검색 동작 확인

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — MkDocs Material 2025-11 유지보수 모드 진입으로 Docusaurus 전환 결정 | Claude Code |
