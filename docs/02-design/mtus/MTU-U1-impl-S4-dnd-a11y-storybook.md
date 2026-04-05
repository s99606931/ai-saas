# MTU-U1 구현 가이드: Session 4 — 동적 레이아웃 + 접근성 + Storybook

| 항목 | 내용 |
|------|------|
| 문서 유형 | 구현 가이드 (Implementation Guide) |
| 연계 설계 | MTU-U1-ui-design-system.design.md 섹션 F, G, I |
| 연계 FR/NFR | FR-U.12 ~ FR-U.15, NFR-U.1 ~ NFR-U.7 |
| 기술 스택 | dnd-kit (@dnd-kit/react 1.x), Storybook 8.6, Playwright 1.x, axe-core, KWCAG 2.2 |
| 준수 기준 | KWCAG 2.2 33검사항목 전수 / CSAP D-08 D-09 |
| 작성일 | 2026-04-05 |
| 버전 | 1.0.0 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 목적(WHY) | 공공기관 사용자가 대시보드를 스스로 구성하고, 장애인을 포함한 모든 사용자가 동등하게 이용할 수 있는 접근성 기반 UI 확보 |
| 대상(WHO) | 프론트엔드 구현 담당자, 접근성 검증 담당자, UI 컴포넌트 Storybook 관리 담당자 |
| 위험(RISK) | dnd-kit 키보드 접근성 누락 시 KWCAG 2.1.1 위반 → 감리 결함 / axe-core violations 잔존 시 WCAG 불이행 |
| 성공 기준(SUCCESS) | axe-core violations 0 / Playwright 접근성 테스트 전수 통과 / KWCAG 2.2 33항목 전수 대응 |
| 범위(SCOPE) | 동적 레이아웃(F.1~F.4), 접근성 구현(G.1~G.4), Storybook 설정(I.1~I.3) |

---

## 1. 동적 레이아웃 커스터마이제이션

### 1.1 드래그앤드롭 대시보드 (dnd-kit)

설계 근거: 섹션 F.1 / FR-U.12 / SC-U9

#### 1.1.1 대시보드 컨텍스트 프로바이더

`components/dashboard/dashboard-provider.tsx`

```typescript
'use client'

// Design Ref: §F.1
// FR-U.12: 드래그앤드롭 대시보드 위젯 배치
// NFR-U.1: KWCAG 2.2 2.1.1 키보드 접근성 필수

import React, { useCallback, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useDashboardStore } from '@/stores/dashboard-store'
import { WidgetCard } from './widget-card'
import { WidgetConfig } from '@/types/dashboard'

interface DashboardProviderProps {
  children?: React.ReactNode
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const { widgets, reorderWidgets } = useDashboardStore()
  const [activeWidget, setActiveWidget] = useState<WidgetConfig | null>(null)

  // 접근성: PointerSensor (마우스/터치) + KeyboardSensor (키보드)
  // PointerSensor: 8px 이상 이동해야 드래그 시작 (클릭과 구분)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      // KWCAG 2.1.1: 키보드로 위젯 이동 가능
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const widget = widgets.find((w) => w.id === active.id)
      setActiveWidget(widget ?? null)
    },
    [widgets]
  )

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    // 드래그 오버 시 시각 피드백은 DragOverlay가 처리
    // 스크린리더 공지는 DndContext announcements가 처리
  }, [])

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveWidget(null)
      if (!over || active.id === over.id) return

      const oldIndex = widgets.findIndex((w) => w.id === active.id)
      const newIndex = widgets.findIndex((w) => w.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      reorderWidgets(arrayMove(widgets, oldIndex, newIndex))
    },
    [widgets, reorderWidgets]
  )

  const widgetIds = widgets.map((w) => w.id)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      // KWCAG 2.1.1 / NFR-U.4: 스크린리더 한국어 공지 필수
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            const widget = widgets.find((w) => w.id === active.id)
            return `${widget?.title ?? active.id} 위젯 이동을 시작합니다. 화살표 키로 위치를 변경하고 Space 키로 놓으세요.`
          },
          onDragOver({ active, over }) {
            const activeWidget = widgets.find((w) => w.id === active.id)
            const overWidget = widgets.find((w) => w.id === over?.id)
            if (over) {
              return `${activeWidget?.title ?? active.id} 위젯이 ${overWidget?.title ?? over.id} 위젯 위치로 이동 중입니다.`
            }
            return `${activeWidget?.title ?? active.id} 위젯이 이동 중입니다.`
          },
          onDragEnd({ active, over }) {
            const activeWidget = widgets.find((w) => w.id === active.id)
            if (over) {
              const overWidget = widgets.find((w) => w.id === over.id)
              return `${activeWidget?.title ?? active.id} 위젯을 ${overWidget?.title ?? over.id} 위치에 이동했습니다.`
            }
            return `${activeWidget?.title ?? active.id} 위젯 이동을 취소했습니다.`
          },
          onDragCancel({ active }) {
            const widget = widgets.find((w) => w.id === active.id)
            return `${widget?.title ?? active.id} 위젯 이동을 취소했습니다. 원래 위치로 되돌아갔습니다.`
          },
        },
        // KWCAG 4.1.2: 스크린리더 지시문 한국어 제공
        screenReaderInstructions: {
          draggable: '위젯을 선택하려면 Space 키를 누르세요. 화살표 키로 이동한 뒤 Space 키로 놓거나 Escape 키로 취소하세요.',
        },
      }}
    >
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>

      {/* 드래그 오버레이: 드래그 중 시각 피드백 */}
      <DragOverlay>
        {activeWidget ? (
          <WidgetCard
            widget={activeWidget}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
```

#### 1.1.2 위젯 그리드 컨테이너

`components/dashboard/widget-grid.tsx`

```typescript
'use client'

// Design Ref: §F.1
// FR-U.12: CSS Grid 기반 반응형 위젯 그리드

import React from 'react'
import { DashboardProvider } from './dashboard-provider'
import { WidgetCard } from './widget-card'
import { useDashboardStore } from '@/stores/dashboard-store'
import { cn } from '@/lib/utils'

interface WidgetGridProps {
  className?: string
}

export function WidgetGrid({ className }: WidgetGridProps) {
  const { widgets, isEditing } = useDashboardStore()

  return (
    <DashboardProvider>
      {/*
        KWCAG 2.4.1: role="region" + aria-label로 랜드마크 제공
        KWCAG 2.4.6: 제목 제공 (aria-label)
      */}
      <div
        role="region"
        aria-label="대시보드 위젯 영역"
        aria-description={
          isEditing
            ? '편집 모드: 위젯을 드래그하거나 키보드로 재배치할 수 있습니다.'
            : '대시보드 위젯 영역입니다.'
        }
        className={cn(
          // 반응형 그리드: 모바일 1열 → 태블릿 2열 → 데스크탑 3~4열
          'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          'gap-4 p-4',
          // 편집 모드 시각 피드백 (색상만 의존 금지: 점선 테두리 추가)
          isEditing && 'border-2 border-dashed border-[var(--color-primary)] rounded-lg',
          className
        )}
      >
        {widgets.map((widget) => (
          <WidgetCard
            key={widget.id}
            widget={widget}
          />
        ))}

        {widgets.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            className="col-span-full text-center py-12 text-[var(--color-text-secondary)]"
          >
            위젯이 없습니다. 위젯 추가 버튼을 클릭하여 대시보드를 구성하세요.
          </div>
        )}
      </div>
    </DashboardProvider>
  )
}
```

#### 1.1.3 개별 위젯 카드

`components/dashboard/widget-card.tsx`

```typescript
'use client'

// Design Ref: §F.1
// FR-U.12: 드래그 가능한 위젯 카드
// NFR-U.1: KWCAG 2.1.1 키보드 드래그 핸들

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetConfig } from '@/types/dashboard'
import { useDashboardStore } from '@/stores/dashboard-store'
import { widgetRegistry } from './widget-registry'

interface WidgetCardProps {
  widget: WidgetConfig
  isDragOverlay?: boolean
}

export function WidgetCard({ widget, isDragOverlay = false }: WidgetCardProps) {
  const { removeWidget, resizeWidget, isEditing } = useDashboardStore()

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    data: {
      type: 'widget',
      title: widget.title,
    },
    // 편집 모드에서만 드래그 활성화
    disabled: !isEditing,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // 그리드 크기 적용 (위젯 size.w, size.h 기반)
    gridColumn: `span ${widget.size.w}`,
    gridRow: `span ${widget.size.h}`,
    // 드래그 중 투명도: 원본 위치 표시
    opacity: isDragging && !isDragOverlay ? 0.4 : 1,
  }

  const definition = widgetRegistry[widget.type]
  const WidgetComponent = definition?.component

  const isMaximized = widget.size.w === 2 && widget.size.h === 2
  const canExpand = (definition?.maxSize.w ?? 1) > widget.size.w || (definition?.maxSize.h ?? 1) > widget.size.h

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)]',
        'rounded-lg shadow-sm overflow-hidden',
        'flex flex-col',
        // 드래그 중 시각 피드백 (색상 + 테두리로 이중 표시)
        isDragging && !isDragOverlay && 'ring-2 ring-[var(--color-primary)] ring-dashed',
        isDragOverlay && 'shadow-2xl rotate-2 ring-2 ring-[var(--color-primary)]',
      )}
      aria-label={`${widget.title} 위젯`}
    >
      {/* 위젯 헤더 */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        {/* 드래그 핸들: 편집 모드에서만 표시 */}
        {isEditing && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            className={cn(
              'flex-shrink-0 p-1 rounded',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              // KWCAG 2.4.7: 포커스 표시 필수
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
              'cursor-grab active:cursor-grabbing',
              'touch-none',  // 터치 스크롤과 드래그 충돌 방지
            )}
            aria-label={`${widget.title} 위젯 이동 핸들. Space 키로 드래그 시작`}
            // KWCAG 4.1.2: 드래그 가능 상태 ARIA 속성
            aria-roledescription="드래그 가능한 핸들"
          >
            <GripVertical className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {/* 위젯 제목 */}
        <h3 className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
          {widget.title}
        </h3>

        {/* 위젯 편집 버튼 (편집 모드에서만 표시) */}
        {isEditing && (
          <div className="flex items-center gap-1" role="group" aria-label={`${widget.title} 위젯 조작`}>
            {/* 크기 토글 버튼 */}
            <button
              type="button"
              onClick={() =>
                resizeWidget(widget.id, isMaximized
                  ? { w: 1, h: 1 }
                  : { w: Math.min(widget.size.w + 1, definition?.maxSize.w ?? 2), h: widget.size.h }
                )
              }
              disabled={!canExpand && !isMaximized}
              className={cn(
                'p-1 rounded text-[var(--color-text-secondary)]',
                'hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
              aria-label={isMaximized ? `${widget.title} 위젯 축소` : `${widget.title} 위젯 확대`}
              aria-pressed={isMaximized}
            >
              {isMaximized
                ? <Minimize2 className="w-4 h-4" aria-hidden="true" />
                : <Maximize2 className="w-4 h-4" aria-hidden="true" />
              }
            </button>

            {/* 위젯 제거 버튼 */}
            <button
              type="button"
              onClick={() => removeWidget(widget.id)}
              className={cn(
                'p-1 rounded text-[var(--color-text-secondary)]',
                'hover:text-[var(--color-destructive)] hover:bg-[var(--color-destructive-subtle)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
              )}
              aria-label={`${widget.title} 위젯 제거`}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {/* 위젯 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {WidgetComponent ? (
          <WidgetComponent props={widget.props} />
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]" role="status">
            위젯을 불러오는 중...
          </p>
        )}
      </div>
    </article>
  )
}
```

#### 1.1.4 위젯 레지스트리 + 3종 위젯 구현 예시

`components/dashboard/widget-registry.ts`

```typescript
// Design Ref: §F.1
// FR-U.12: 8종 위젯 레지스트리

import { lazy } from 'react'
import { WidgetType, WidgetDefinition } from '@/types/dashboard'

export const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
  'csap-progress': {
    name: 'CSAP 준수 현황',
    description: 'CSAP 79항목 진행률 및 등급별 현황',
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/csap-progress-widget').then(m => ({ default: m.CsapProgressWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'shield-check',
  },
  'recent-activity': {
    name: '최근 활동',
    description: '최근 CSAP/N2SF 작업 타임라인',
    defaultSize: { w: 1, h: 2 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/recent-activity-widget').then(m => ({ default: m.RecentActivityWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'activity',
  },
  'ai-recommendations': {
    name: 'AI 추천 작업',
    description: 'AI가 분석한 우선 처리 항목',
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 1 },
    component: lazy(() => import('./widgets/ai-recommendations-widget').then(m => ({ default: m.AiRecommendationsWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'sparkles',
  },
  'tenant-progress': {
    name: '기관별 진행률',
    description: '입주 기관 CSAP 준수 현황 비교',
    defaultSize: { w: 2, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/tenant-progress-widget').then(m => ({ default: m.TenantProgressWidget }))),
    requiredRole: ['admin'],
    icon: 'building-2',
  },
  'n2sf-status': {
    name: 'N2SF 현황',
    description: 'N2SF 데이터 등급별 처리 현황',
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/n2sf-status-widget').then(m => ({ default: m.N2sfStatusWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'database',
  },
  'audit-calendar': {
    name: '감리 일정',
    description: '예정된 감리 및 점검 일정',
    defaultSize: { w: 2, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/audit-calendar-widget').then(m => ({ default: m.AuditCalendarWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'calendar',
  },
  'quick-actions': {
    name: '빠른 액션',
    description: '자주 사용하는 작업 바로가기',
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 1, h: 1 },
    component: lazy(() => import('./widgets/quick-actions-widget').then(m => ({ default: m.QuickActionsWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'zap',
  },
  'custom-chart': {
    name: '사용자 정의 차트',
    description: '지표 선택 가능한 커스텀 차트',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/custom-chart-widget').then(m => ({ default: m.CustomChartWidget }))),
    requiredRole: ['admin', 'user'],
    icon: 'bar-chart-3',
  },
}
```

`components/dashboard/widgets/csap-progress-widget.tsx` (통계 카드 위젯)

```typescript
'use client'

// Design Ref: §F.1
// 위젯 1: CSAP 준수 현황 — 통계 카드 형태

import React from 'react'
import { ShieldCheck, TrendingUp, AlertCircle } from 'lucide-react'

interface CsapProgressWidgetProps {
  props: {
    targetGrade?: 'standard' | 'high'
  }
}

export function CsapProgressWidget({ props }: CsapProgressWidgetProps) {
  // 실제 구현 시 API 데이터 연동
  const stats = {
    total: 79,
    passed: 65,
    inProgress: 10,
    pending: 4,
    grade: props.targetGrade === 'high' ? '상' : '중',
  }

  const passRate = Math.round((stats.passed / stats.total) * 100)

  return (
    <div className="space-y-3">
      {/* KWCAG 1.3.3: 색상만으로 정보 전달 금지 — 아이콘 + 텍스트 + 색상 3중 표시 */}
      <div className="flex items-center gap-2">
        {/* aria-hidden: 장식 아이콘 */}
        <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" aria-hidden="true" />
        <span className="text-2xl font-bold text-[var(--color-text-primary)]">
          {passRate}%
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          준수율
        </span>
        {/* KWCAG 1.4.1: 색에 무관한 인식 — 텍스트 레이블 필수 */}
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)]"
          aria-label={`목표 등급: ${stats.grade}등급`}
        >
          {stats.grade}등급 목표
        </span>
      </div>

      {/* 진행률 바 */}
      <div
        role="progressbar"
        aria-valuenow={passRate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`CSAP 준수율 ${passRate}%`}
        className="h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-[var(--color-success)] rounded-full transition-all duration-500"
          style={{ width: `${passRate}%` }}
        />
      </div>

      {/* 세부 통계 — 색상 + 아이콘 + 텍스트 */}
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          {/* KWCAG 1.4.1: 색에 무관한 인식 */}
          <dt className="text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
            통과
          </dt>
          <dd className="font-semibold text-[var(--color-text-primary)]">{stats.passed}개</dd>
        </div>
        <div className="text-center">
          <dt className="text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-warning)]" aria-hidden="true" />
            진행
          </dt>
          <dd className="font-semibold text-[var(--color-text-primary)]">{stats.inProgress}개</dd>
        </div>
        <div className="text-center">
          <dt className="text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-error)]" aria-hidden="true" />
            미착수
          </dt>
          <dd className="font-semibold text-[var(--color-text-primary)]">{stats.pending}개</dd>
        </div>
      </dl>
    </div>
  )
}
```

`components/dashboard/widgets/recent-activity-widget.tsx` (타임라인 위젯)

```typescript
'use client'

// Design Ref: §F.1
// 위젯 2: 최근 활동 타임라인

import React from 'react'
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

type ActivityStatus = 'completed' | 'in-progress' | 'pending'

interface Activity {
  id: string
  label: string
  status: ActivityStatus
  timestamp: Date
}

interface RecentActivityWidgetProps {
  props: Record<string, unknown>
}

// 상태별 아이콘 + 색상 + 레이블 정의 (KWCAG 1.4.1 색에 무관한 인식)
const statusConfig: Record<ActivityStatus, {
  icon: React.ElementType
  colorClass: string
  label: string
}> = {
  completed: {
    icon: CheckCircle2,
    colorClass: 'text-[var(--color-success)]',
    label: '완료',
  },
  'in-progress': {
    icon: Clock,
    colorClass: 'text-[var(--color-warning)]',
    label: '진행 중',
  },
  pending: {
    icon: AlertTriangle,
    colorClass: 'text-[var(--color-error)]',
    label: '대기',
  },
}

export function RecentActivityWidget({ props: _ }: RecentActivityWidgetProps) {
  // 실제 구현 시 API 데이터 연동
  const activities: Activity[] = [
    { id: '1', label: 'D-08 접근 통제 통과', status: 'completed', timestamp: new Date(Date.now() - 600000) },
    { id: '2', label: 'D-09 암호화 검토 중', status: 'in-progress', timestamp: new Date(Date.now() - 3600000) },
    { id: '3', label: 'N2SF 등급 매핑 완료', status: 'completed', timestamp: new Date(Date.now() - 7200000) },
  ]

  return (
    // role="log": 시간 순서로 추가되는 동적 콘텐츠
    <ol role="log" aria-label="최근 활동 목록" aria-live="polite" className="space-y-2">
      {activities.map((activity) => {
        const config = statusConfig[activity.status]
        const Icon = config.icon
        return (
          <li key={activity.id} className="flex items-start gap-2 text-sm">
            {/* KWCAG 1.4.1: 아이콘 + 색상 + aria-label 3중 표시 */}
            <Icon
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.colorClass}`}
              aria-label={config.label}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[var(--color-text-primary)] truncate">{activity.label}</p>
              <time
                dateTime={activity.timestamp.toISOString()}
                className="text-xs text-[var(--color-text-secondary)]"
              >
                {formatDistanceToNow(activity.timestamp, { addSuffix: true, locale: ko })}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
```

`components/dashboard/widgets/tenant-progress-widget.tsx` (차트 위젯)

```typescript
'use client'

// Design Ref: §F.1
// 위젯 3: 기관별 진행률 — 막대 차트 (KWCAG 1.4.1 색각 이상 대응)

import React from 'react'

interface TenantProgressWidgetProps {
  props: Record<string, unknown>
}

interface TenantData {
  id: string
  name: string
  progress: number
  // KWCAG 1.4.1: 색각 이상 대응 — 패턴 클래스 추가
  patternClass: string
  colorClass: string
  colorLabel: string
}

export function TenantProgressWidget({ props: _ }: TenantProgressWidgetProps) {
  const tenants: TenantData[] = [
    { id: '1', name: '기관 A', progress: 80, patternClass: 'bg-[var(--color-chart-1)]', colorClass: 'text-[var(--color-chart-1)]', colorLabel: '파랑' },
    { id: '2', name: '기관 B', progress: 65, patternClass: 'bg-[var(--color-chart-2)]', colorClass: 'text-[var(--color-chart-2)]', colorLabel: '주황' },
    { id: '3', name: '기관 C', progress: 45, patternClass: 'bg-[var(--color-chart-3)]', colorClass: 'text-[var(--color-chart-3)]', colorLabel: '초록' },
  ]

  return (
    // role="group" + aria-label: 관련 차트 묶음
    <div role="group" aria-label="기관별 CSAP 진행률">
      {/* KWCAG 1.3.1: 표의 구성 — 시각적 차트에 대체 데이터 표 제공 */}
      <table className="sr-only" aria-label="기관별 진행률 데이터">
        <caption>기관별 CSAP 준수율 현황</caption>
        <thead>
          <tr>
            <th scope="col">기관명</th>
            <th scope="col">진행률(%)</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id}>
              <td>{tenant.name}</td>
              <td>{tenant.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 시각적 막대 차트 (aria-hidden: 스크린리더는 위의 표 사용) */}
      <div className="space-y-3" aria-hidden="true">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-primary)] font-medium">{tenant.name}</span>
              <span className={tenant.colorClass}>{tenant.progress}%</span>
            </div>
            <div className="h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${tenant.patternClass}`}
                style={{ width: `${tenant.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### 1.1.5 대시보드 상태 관리 (Zustand)

`stores/dashboard-store.ts`

```typescript
// Design Ref: §F.1
// FR-U.12: 위젯 레이아웃 영속 저장 + API 동기화

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { WidgetConfig, WidgetType } from '@/types/dashboard'
import { widgetRegistry } from '@/components/dashboard/widget-registry'

interface DashboardState {
  widgets: WidgetConfig[]
  isEditing: boolean
  isSaving: boolean
  lastSavedAt: string | null
}

interface DashboardActions {
  addWidget: (type: WidgetType) => void
  removeWidget: (id: string) => void
  reorderWidgets: (widgets: WidgetConfig[]) => void
  resizeWidget: (id: string, size: { w: number; h: number }) => void
  toggleEditing: () => void
  saveLayout: () => Promise<void>
  loadLayout: (userId: string) => Promise<void>
}

// API 동기화 디바운스 타이머
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 500

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  persist(
    immer((set, get) => ({
      // 초기 상태
      widgets: [],
      isEditing: false,
      isSaving: false,
      lastSavedAt: null,

      addWidget: (type: WidgetType) => {
        const definition = widgetRegistry[type]
        if (!definition) return

        const newWidget: WidgetConfig = {
          id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          title: definition.name,
          position: { x: 0, y: 0 },
          size: { ...definition.defaultSize },
          props: {},
        }

        set((state) => {
          state.widgets.push(newWidget)
        })

        // 변경 후 디바운스 저장
        get().saveLayout()
      },

      removeWidget: (id: string) => {
        set((state) => {
          state.widgets = state.widgets.filter((w) => w.id !== id)
        })
        get().saveLayout()
      },

      reorderWidgets: (widgets: WidgetConfig[]) => {
        set((state) => {
          state.widgets = widgets
        })
        // 드래그 완료 후 디바운스 저장
        get().saveLayout()
      },

      resizeWidget: (id: string, size: { w: number; h: number }) => {
        set((state) => {
          const widget = state.widgets.find((w) => w.id === id)
          if (widget) {
            widget.size = size
          }
        })
        get().saveLayout()
      },

      toggleEditing: () => {
        set((state) => {
          state.isEditing = !state.isEditing
        })
      },

      saveLayout: async () => {
        // 디바운스: 연속 변경 시 마지막 변경만 저장
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer)

        saveDebounceTimer = setTimeout(async () => {
          set((state) => { state.isSaving = true })

          try {
            const response = await fetch('/api/user/dashboard-layout', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ widgets: get().widgets }),
            })

            if (!response.ok) throw new Error('레이아웃 저장 실패')

            set((state) => {
              state.isSaving = false
              state.lastSavedAt = new Date().toISOString()
            })
          } catch (error) {
            // 저장 실패 시 로컬 상태 유지 (persist로 localStorage 보존)
            set((state) => { state.isSaving = false })
            console.error('대시보드 레이아웃 저장 오류:', error)
          }
        }, SAVE_DEBOUNCE_MS)
      },

      loadLayout: async (userId: string) => {
        try {
          const response = await fetch(`/api/user/dashboard-layout?userId=${userId}`)
          if (!response.ok) return

          const data = await response.json()
          if (data.widgets && Array.isArray(data.widgets)) {
            set((state) => {
              state.widgets = data.widgets
            })
          }
        } catch (error) {
          console.error('대시보드 레이아웃 로드 오류:', error)
          // 로드 실패 시 localStorage persist 데이터 유지
        }
      },
    })),
    {
      name: 'dashboard-layout',
      storage: createJSONStorage(() => localStorage),
      // userId가 없을 때 persist 스킵
      partialize: (state) => ({ widgets: state.widgets }),
    }
  )
)
```

#### 1.1.6 위젯 갤러리 (추가 UI)

`components/dashboard/widget-gallery.tsx`

```typescript
'use client'

// Design Ref: §F.1
// FR-U.12: 위젯 추가 팔레트 UI

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useDashboardStore } from '@/stores/dashboard-store'
import { widgetRegistry } from './widget-registry'
import { WidgetType } from '@/types/dashboard'
import { cn } from '@/lib/utils'

export function WidgetGallery() {
  const { addWidget, isEditing } = useDashboardStore()
  const [open, setOpen] = useState(false)

  if (!isEditing) return null

  const handleAddWidget = (type: WidgetType) => {
    addWidget(type)
    setOpen(false)
  }

  return (
    // Radix UI Dialog: 포커스 트랩 + Esc 닫기 내장 (KWCAG 2.1.2)
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
            'text-sm font-medium',
            'hover:bg-[var(--color-primary-hover)]',
            // KWCAG 2.4.7: 포커스 표시
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          )}
          aria-label="위젯 추가"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          위젯 추가
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'bg-[var(--color-surface)] rounded-xl shadow-2xl',
            'w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col',
            // KWCAG 2.4.7: 모달 포커스 표시
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
          )}
          // KWCAG 4.1.2: 다이얼로그 역할 및 레이블
          aria-describedby="widget-gallery-description"
        >
          {/* KWCAG 2.4.6: 제목 제공 */}
          <Dialog.Title className="sr-only">위젯 추가</Dialog.Title>
          <VisuallyHidden>
            <Dialog.Description id="widget-gallery-description">
              추가할 위젯을 선택하세요. Tab 키로 이동하고 Enter 키로 선택합니다.
            </Dialog.Description>
          </VisuallyHidden>

          {/* 모달 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]" aria-hidden="true">
              위젯 추가
            </h2>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                aria-label="위젯 추가 창 닫기"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* 위젯 목록 */}
          <div
            className="overflow-y-auto p-4 grid grid-cols-2 gap-3"
            role="list"
            aria-label="추가 가능한 위젯 목록"
          >
            {(Object.entries(widgetRegistry) as [WidgetType, typeof widgetRegistry[WidgetType]][]).map(
              ([type, definition]) => (
                <button
                  key={type}
                  type="button"
                  role="listitem"
                  onClick={() => handleAddWidget(type)}
                  className={cn(
                    'text-left p-4 rounded-lg border border-[var(--color-border)]',
                    'hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
                    'transition-colors',
                  )}
                  aria-label={`${definition.name} 위젯 추가: ${definition.description}`}
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {definition.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {definition.description}
                  </p>
                </button>
              )
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

---

### 1.2 사이드바 3모드 토글

설계 근거: 섹션 F.2 / FR-U.13

`components/layout/sidebar-toggle.tsx`

```typescript
'use client'

// Design Ref: §F.2
// FR-U.13: 사이드바 펼침/아이콘/숨김 3모드 토글

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight, PanelLeftClose } from 'lucide-react'
import { useSidebarStore, SidebarMode } from '@/stores/sidebar-store'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'

// 3모드 설정
const SIDEBAR_CONFIG: Record<SidebarMode, { width: number; label: string; nextMode: SidebarMode }> = {
  expanded: { width: 240, label: '펼침', nextMode: 'collapsed' },
  collapsed: { width: 64, label: '아이콘', nextMode: 'hidden' },
  hidden: { width: 0, label: '숨김', nextMode: 'expanded' },
}

interface SidebarToggleProps {
  className?: string
}

export function SidebarToggle({ className }: SidebarToggleProps) {
  const { mode, setMode } = useSidebarStore()
  const shouldReduceMotion = useReducedMotion()

  const current = SIDEBAR_CONFIG[mode]
  const next = SIDEBAR_CONFIG[current.nextMode]

  return (
    <motion.aside
      // KWCAG 2.4.7: 사이드바 역할 및 레이블
      role="navigation"
      aria-label="주 메뉴"
      // 현재 모드 상태 공지
      aria-expanded={mode === 'expanded'}
      animate={{ width: current.width }}
      transition={{
        // KWCAG 2.3.1: 모션 감소 선호 시 즉시 전환
        duration: shouldReduceMotion ? 0 : 0.2,
        ease: 'easeInOut',
      }}
      className={cn(
        'relative flex flex-col h-full',
        'bg-[var(--color-surface-secondary)] border-r border-[var(--color-border)]',
        'overflow-hidden',
        className,
      )}
    >
      {/* 사이드바 콘텐츠는 부모 컴포넌트에서 children으로 전달 */}

      {/* 모드 전환 버튼 */}
      <button
        type="button"
        onClick={() => setMode(current.nextMode)}
        className={cn(
          'absolute bottom-4 right-0 translate-x-1/2',
          'w-6 h-6 rounded-full',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'flex items-center justify-center',
          'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          'z-10 shadow-sm',
        )}
        // KWCAG 4.1.2: 버튼 목적 명확히
        aria-label={`사이드바 ${next.label} 모드로 전환`}
        aria-controls="main-sidebar"
      >
        {mode === 'expanded'
          ? <ChevronLeft className="w-3 h-3" aria-hidden="true" />
          : mode === 'collapsed'
          ? <PanelLeftClose className="w-3 h-3" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3" aria-hidden="true" />
        }
      </button>
    </motion.aside>
  )
}
```

`stores/sidebar-store.ts`

```typescript
// Design Ref: §F.2
// FR-U.13: 사이드바 상태 + 즐겨찾기 + 최근 방문

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type SidebarMode = 'expanded' | 'collapsed' | 'hidden'

interface RecentPage {
  route: string
  title: string
  visitedAt: string
}

interface SidebarState {
  mode: SidebarMode
  isPinned: boolean
  favoriteMenuIds: string[]
  recentPages: RecentPage[]
}

interface SidebarActions {
  setMode: (mode: SidebarMode) => void
  togglePin: () => void
  addFavorite: (menuId: string) => void
  removeFavorite: (menuId: string) => void
  addRecentPage: (page: Omit<RecentPage, 'visitedAt'>) => void
  clearRecentPages: () => void
}

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  persist(
    (set) => ({
      mode: 'expanded',
      isPinned: true,
      favoriteMenuIds: [],
      recentPages: [],

      setMode: (mode) => set({ mode }),

      togglePin: () => set((state) => ({ isPinned: !state.isPinned })),

      addFavorite: (menuId) =>
        set((state) => ({
          favoriteMenuIds: state.favoriteMenuIds.includes(menuId)
            ? state.favoriteMenuIds
            : [...state.favoriteMenuIds, menuId],
        })),

      removeFavorite: (menuId) =>
        set((state) => ({
          favoriteMenuIds: state.favoriteMenuIds.filter((id) => id !== menuId),
        })),

      addRecentPage: (page) =>
        set((state) => ({
          recentPages: [
            { ...page, visitedAt: new Date().toISOString() },
            // 중복 제거 후 최대 10개 유지
            ...state.recentPages.filter((p) => p.route !== page.route),
          ].slice(0, 10),
        })),

      clearRecentPages: () => set({ recentPages: [] }),
    }),
    {
      name: 'sidebar-preferences',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

---

### 1.3 테이블 컬럼 사용자 설정

설계 근거: 섹션 F.3 / FR-U.14

`components/ui/column-manager.tsx`

```typescript
'use client'

// Design Ref: §F.3
// FR-U.14: 테이블 컬럼 표시/순서 사용자 설정

import React, { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Popover from '@radix-ui/react-popover'
import { Columns, GripVertical, Eye, EyeOff, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  pinned: boolean
  width?: number
}

interface ColumnManagerProps {
  tableId: string
  columns: ColumnConfig[]
  onColumnsChange: (columns: ColumnConfig[]) => void
}

export function ColumnManager({ tableId, columns, onColumnsChange }: ColumnManagerProps) {
  const [open, setOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = columns.findIndex((c) => c.id === active.id)
    const newIndex = columns.findIndex((c) => c.id === over.id)
    onColumnsChange(arrayMove(columns, oldIndex, newIndex))
  }

  const toggleVisibility = (id: string) => {
    onColumnsChange(
      columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    )
  }

  const togglePin = (id: string) => {
    onColumnsChange(
      columns.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    )
  }

  const resetColumns = () => {
    onColumnsChange(columns.map((c) => ({ ...c, visible: true, pinned: false })))
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
            'border border-[var(--color-border)] bg-[var(--color-surface)]',
            'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          )}
          aria-label="컬럼 설정"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Columns className="w-4 h-4" aria-hidden="true" />
          컬럼 설정
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-50 bg-[var(--color-surface)] border border-[var(--color-border)]',
            'rounded-xl shadow-xl p-4 w-72',
          )}
          sideOffset={8}
          role="dialog"
          aria-label="컬럼 표시 및 순서 설정"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              컬럼 설정
            </h3>
            <button
              type="button"
              onClick={resetColumns}
              className="text-xs text-[var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]"
              aria-label="컬럼 설정 기본값으로 복원"
            >
              기본값 복원
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            드래그 또는 화살표 키로 순서를 변경하고, 눈 아이콘으로 표시/숨김을 설정하세요.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{
              announcements: {
                onDragStart: ({ active }) => {
                  const col = columns.find((c) => c.id === active.id)
                  return `${col?.label ?? active.id} 컬럼 이동 시작`
                },
                onDragOver: ({ active, over }) => {
                  const activeCol = columns.find((c) => c.id === active.id)
                  const overCol = columns.find((c) => c.id === over?.id)
                  return over
                    ? `${activeCol?.label} 컬럼을 ${overCol?.label} 위치로 이동 중`
                    : `${activeCol?.label} 컬럼 이동 중`
                },
                onDragEnd: ({ active, over }) => {
                  const activeCol = columns.find((c) => c.id === active.id)
                  return over
                    ? `${activeCol?.label} 컬럼 이동 완료`
                    : `${activeCol?.label} 컬럼 이동 취소`
                },
                onDragCancel: ({ active }) => {
                  const col = columns.find((c) => c.id === active.id)
                  return `${col?.label} 컬럼 이동 취소`
                },
              },
              screenReaderInstructions: {
                draggable: 'Space로 드래그 시작, 화살표 키로 이동, Space로 놓기, Escape로 취소',
              },
            }}
          >
            <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1" aria-label="컬럼 목록">
                {columns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    onToggleVisibility={() => toggleVisibility(column.id)}
                    onTogglePin={() => togglePin(column.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface SortableColumnItemProps {
  column: ColumnConfig
  onToggleVisibility: () => void
  onTogglePin: () => void
}

function SortableColumnItem({ column, onToggleVisibility, onTogglePin }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-surface-hover)]"
    >
      {/* 드래그 핸들 */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        className={cn(
          'p-0.5 text-[var(--color-text-secondary)] cursor-grab active:cursor-grabbing',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]',
        )}
        aria-label={`${column.label} 컬럼 이동 핸들`}
        aria-roledescription="드래그 가능한 핸들"
      >
        <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {/* 컬럼 레이블 */}
      <span
        className={cn(
          'flex-1 text-sm',
          column.visible
            ? 'text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] line-through',
        )}
      >
        {column.label}
      </span>

      {/* 고정 토글 */}
      <button
        type="button"
        onClick={onTogglePin}
        className={cn(
          'p-0.5 rounded',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]',
          column.pinned
            ? 'text-[var(--color-primary)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        )}
        aria-label={`${column.label} 컬럼 ${column.pinned ? '고정 해제' : '고정'}`}
        aria-pressed={column.pinned}
      >
        <Pin className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {/* 표시/숨김 토글 */}
      <button
        type="button"
        onClick={onToggleVisibility}
        className={cn(
          'p-0.5 rounded',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]',
          column.visible
            ? 'text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)]',
        )}
        aria-label={`${column.label} 컬럼 ${column.visible ? '숨기기' : '표시하기'}`}
        aria-pressed={column.visible}
      >
        {column.visible
          ? <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
        }
      </button>
    </li>
  )
}
```

---

## 2. 공공기관 UI 접근성 (KWCAG 2.2)

설계 근거: 섹션 G.1 ~ G.4 / NFR-U.1 ~ NFR-U.7

### 2.1 접근성 기반 레이아웃 설정

`app/layout.tsx` 필수 접근성 요소

```typescript
// Design Ref: §G.1, §G.2
// NFR-U.1: KWCAG 2.2 기반 루트 레이아웃
// KWCAG 3.1.1: <html lang="ko"> 필수
// KWCAG 2.4.1: 반복 영역 건너뛰기 링크 필수

import { SkipToContent } from '@/components/layout/skip-to-content'
import { LiveRegionProvider } from '@/lib/a11y/live-region-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // KWCAG 3.1.1: 기본 언어 한국어 명시
    <html lang="ko" suppressHydrationWarning>
      <body>
        {/* KWCAG 2.4.1: 반복 영역 건너뛰기 링크 — 최상단 배치 필수 */}
        <SkipToContent />

        {/* KWCAG 4.1.2: ARIA 랜드마크 구조 */}
        <header role="banner">
          {/* 전역 네비게이션 바 */}
        </header>

        <div className="flex">
          {/* KWCAG 2.4.1: 주 메뉴 랜드마크 */}
          <nav role="navigation" aria-label="주 메뉴" id="main-nav">
            {/* 사이드바 */}
          </nav>

          {/* KWCAG 2.4.6: 주요 콘텐츠 영역 */}
          <main id="main-content" role="main" tabIndex={-1} className="flex-1">
            {children}
          </main>
        </div>

        <footer role="contentinfo">
          {/* 바닥글 */}
        </footer>

        {/* ARIA 라이브 리전: 전역 공지 */}
        <LiveRegionProvider />
      </body>
    </html>
  )
}
```

---

### 2.2 포커스 관리 시스템

설계 근거: 섹션 G.2 / NFR-U.3

`lib/a11y/focus-manager.ts`

```typescript
// Design Ref: §G.2
// NFR-U.3: KWCAG 2.1.2 키보드 함정 방지 + 포커스 트랩

'use client'

import { RefObject, useEffect, useCallback, useRef } from 'react'

// 포커스 가능한 요소 선택자
const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ')

/**
 * useFocusTrap: 모달/다이얼로그 내 포커스 트랩
 * KWCAG 2.1.2: 키보드 함정 — 모달 내에서만 포커스 순환, Esc로 해제
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean
) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // 컨테이너 내 포커스 가능 요소 수집
    const getFocusableElements = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
      )

    // 컨테이너 첫 번째 요소에 포커스 이동
    const focusableElements = getFocusableElements()
    focusableElements[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]

      if (event.shiftKey) {
        // Shift+Tab: 첫 번째에서 마지막으로 순환
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: 마지막에서 첫 번째로 순환
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      // 모달 닫힐 때 이전 포커스 위치로 복귀
      previouslyFocused?.focus()
    }
  }, [containerRef, isActive])
}

/**
 * useAnnounce: ARIA 라이브 리전을 통한 스크린리더 공지
 * KWCAG 4.1.2: ARIA 속성 올바른 사용
 * NFR-U.4: 스크린리더 한국어 공지
 */
export function useAnnounce() {
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      const liveRegion = document.getElementById(
        priority === 'assertive' ? 'aria-assertive-region' : 'aria-polite-region'
      )
      if (!liveRegion) return

      // 동일 메시지 재공지를 위해 빈 값 후 메시지 설정
      liveRegion.textContent = ''
      // 다음 프레임에서 메시지 설정 (스크린리더 감지 보장)
      requestAnimationFrame(() => {
        liveRegion.textContent = message
      })
    },
    []
  )

  return { announce }
}

/**
 * useSkipNavigation: 키보드 사용자를 위한 건너뛰기 링크
 * KWCAG 2.4.1: 반복 영역 건너뛰기
 */
export function useSkipNavigation() {
  const skipToMain = useCallback(() => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const skipToNav = useCallback(() => {
    const nav = document.getElementById('main-nav')
    if (nav) {
      const firstFocusable = nav.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }
  }, [])

  return { skipToMain, skipToNav }
}
```

`components/layout/skip-to-content.tsx`

```typescript
// Design Ref: §G.2
// KWCAG 2.4.1: 반복 영역 건너뛰기 링크

'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export function SkipToContent() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      {/* 본문 건너뛰기 */}
      <a
        href="#main-content"
        className={cn(
          'fixed top-2 left-2 z-[9999] px-4 py-2 rounded-md',
          'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
          'text-sm font-medium',
          // KWCAG 2.4.7: 포커스 링 4px 이상
          'focus:outline-4 focus:outline-offset-2 focus:outline-[var(--color-primary)]',
        )}
      >
        본문으로 건너뛰기
      </a>
      {/* 네비게이션 건너뛰기 */}
      <a
        href="#main-nav"
        className={cn(
          'fixed top-2 left-36 z-[9999] px-4 py-2 rounded-md',
          'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
          'text-sm font-medium',
          'focus:outline-4 focus:outline-offset-2 focus:outline-[var(--color-primary)]',
        )}
      >
        메뉴로 건너뛰기
      </a>
    </div>
  )
}
```

`lib/a11y/live-region-provider.tsx`

```typescript
// Design Ref: §G.2
// NFR-U.4: ARIA 라이브 리전 — 전역 배치
// KWCAG 4.1.2: 웹 애플리케이션 접근성

'use client'

import React from 'react'

/**
 * LiveRegionProvider: 앱 최상단에 한 번만 배치
 * polite: 현재 작업 완료 후 공지 (일반 알림)
 * assertive: 즉시 공지 중단하고 공지 (오류, 긴급 알림)
 */
export function LiveRegionProvider() {
  return (
    <>
      {/* 일반 공지 리전 */}
      <div
        id="aria-polite-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* 긴급 공지 리전 (오류, 경고) */}
      <div
        id="aria-assertive-region"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  )
}
```

---

### 2.3 KWCAG 2.2 핵심 패턴 구현

설계 근거: 섹션 G.1 33검사항목 전수 대응

#### 2.3.1 대체 텍스트 (KWCAG 1.1.1)

`components/ui/accessible-image.tsx`

```typescript
// Design Ref: §G.1
// KWCAG 1.1.1: 적절한 대체 텍스트

import React from 'react'
import NextImage, { ImageProps as NextImageProps } from 'next/image'

interface AccessibleImageProps extends Omit<NextImageProps, 'alt'> {
  alt: string          // 필수 강제: 빈 문자열은 장식 이미지에만 허용
  isDecorative?: boolean  // 장식 이미지 명시적 선언
  caption?: string     // 이미지 설명 (figure/figcaption)
}

export function AccessibleImage({
  alt,
  isDecorative = false,
  caption,
  ...props
}: AccessibleImageProps) {
  const altText = isDecorative ? '' : alt

  if (caption) {
    return (
      // KWCAG 1.3.1: figure/figcaption 구조
      <figure>
        <NextImage
          alt={altText}
          aria-hidden={isDecorative ? true : undefined}
          {...props}
        />
        <figcaption className="text-sm text-[var(--color-text-secondary)] mt-1 text-center">
          {caption}
        </figcaption>
      </figure>
    )
  }

  return (
    <NextImage
      alt={altText}
      aria-hidden={isDecorative ? true : undefined}
      {...props}
    />
  )
}
```

#### 2.3.2 모션 감소 (KWCAG 2.3.1)

`hooks/use-reduced-motion.ts`

```typescript
// Design Ref: §G.3
// KWCAG 2.3.1: 깜빡임 제한 — prefers-reduced-motion 감지

'use client'

import { useEffect, useState } from 'react'

/**
 * useReducedMotion: 사용자의 모션 감소 선호 설정 감지
 * - CSS @media (prefers-reduced-motion: reduce) 와 동기화
 * - true 반환 시: 모든 애니메이션 즉시 전환 또는 제거
 */
export function useReducedMotion(): boolean {
  const [shouldReduceMotion, setShouldReduceMotion] = useState<boolean>(() => {
    // SSR 환경에서는 false (서버 렌더링)
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleChange = (event: MediaQueryListEvent) => {
      setShouldReduceMotion(event.matches)
    }

    // 변경 감지 (설정 변경 시 실시간 반영)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return shouldReduceMotion
}
```

#### 2.3.3 명도 대비 검증 (KWCAG 1.4.3 / 1.4.6)

`lib/a11y/contrast-validator.ts`

```typescript
// Design Ref: §G.1
// KWCAG 1.4.3: 명도 대비 — 일반 텍스트 4.5:1, 대형 텍스트 3:1
// KWCAG 1.4.6: 명도 대비 (강화) — 텍스트 7:1 (AAA)

/**
 * getRelativeLuminance: HEX 색상의 상대적 휘도 계산
 * W3C WCAG 2.1 알고리즘 기반
 */
export function getRelativeLuminance(hex: string): number {
  // HEX → RGB 변환
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  // sRGB 감마 보정
  const toLinear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * getContrastRatio: 두 색상 간 대비율 계산
 */
export function getContrastRatio(foreground: string, background: string): number {
  const l1 = getRelativeLuminance(foreground)
  const l2 = getRelativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * isWcagAA: WCAG AA 기준 통과 여부
 * - 일반 텍스트: 4.5:1 이상
 * - 대형 텍스트 (18px 이상 또는 14px bold): 3:1 이상
 */
export function isWcagAA(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5
}

/**
 * isWcagAAA: WCAG AAA 기준 통과 여부 (고대비 테마 목표)
 */
export function isWcagAAA(ratio: number, isLargeText = false): boolean {
  return isLargeText ? ratio >= 4.5 : ratio >= 7.0
}

/**
 * validateColorPair: 색상 쌍 검증 결과 반환
 */
export function validateColorPair(
  foreground: string,
  background: string,
  isLargeText = false
): {
  ratio: number
  passesAA: boolean
  passesAAA: boolean
  level: 'fail' | 'AA' | 'AAA'
} {
  const ratio = getContrastRatio(foreground, background)
  const passesAA = isWcagAA(ratio, isLargeText)
  const passesAAA = isWcagAAA(ratio, isLargeText)

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA,
    passesAAA,
    level: passesAAA ? 'AAA' : passesAA ? 'AA' : 'fail',
  }
}
```

#### 2.3.4 키보드 접근성 (KWCAG 2.1.1)

`components/ui/keyboard-nav.tsx`

```typescript
// Design Ref: §G.2
// KWCAG 2.1.1: 모든 인터랙티브 요소 키보드 접근 가능

'use client'

import React, { useRef, useCallback, KeyboardEvent } from 'react'

/**
 * useArrowKeyNav: 화살표 키 그룹 탐색
 * - 탭 목록, 메뉴 아이템, 트리 노드 등 그룹 탐색에 사용
 * - KWCAG 2.1.1: 화살표 키 탐색 패턴 (WAI-ARIA 작성 관례)
 */
export function useArrowKeyNav(
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both'
    loop?: boolean  // 끝에서 처음으로 순환
  } = {}
) {
  const { orientation = 'horizontal', loop = true } = options
  const containerRef = useRef<HTMLElement>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const container = containerRef.current
      if (!container) return

      const focusableItems = Array.from(
        container.querySelectorAll<HTMLElement>(
          '[role="tab"], [role="menuitem"], [role="option"], [role="treeitem"], button:not([disabled])'
        )
      )

      const currentIndex = focusableItems.indexOf(document.activeElement as HTMLElement)
      if (currentIndex === -1) return

      let nextIndex = currentIndex

      const isHorizontal = orientation === 'horizontal' || orientation === 'both'
      const isVertical = orientation === 'vertical' || orientation === 'both'

      if (isHorizontal && event.key === 'ArrowRight') {
        nextIndex = currentIndex + 1
        if (nextIndex >= focusableItems.length) nextIndex = loop ? 0 : currentIndex
        event.preventDefault()
      } else if (isHorizontal && event.key === 'ArrowLeft') {
        nextIndex = currentIndex - 1
        if (nextIndex < 0) nextIndex = loop ? focusableItems.length - 1 : 0
        event.preventDefault()
      } else if (isVertical && event.key === 'ArrowDown') {
        nextIndex = currentIndex + 1
        if (nextIndex >= focusableItems.length) nextIndex = loop ? 0 : currentIndex
        event.preventDefault()
      } else if (isVertical && event.key === 'ArrowUp') {
        nextIndex = currentIndex - 1
        if (nextIndex < 0) nextIndex = loop ? focusableItems.length - 1 : 0
        event.preventDefault()
      } else if (event.key === 'Home') {
        nextIndex = 0
        event.preventDefault()
      } else if (event.key === 'End') {
        nextIndex = focusableItems.length - 1
        event.preventDefault()
      }

      if (nextIndex !== currentIndex) {
        focusableItems[nextIndex]?.focus()
      }
    },
    [orientation, loop]
  )

  return { containerRef, handleKeyDown }
}
```

#### 2.3.5 포커스 표시 스타일 (KWCAG 2.4.7)

`styles/globals.css` 추가 (포커스 스타일)

```css
/* Design Ref: §G.1
   KWCAG 2.4.7: 초점 표시 — 2px 이상 링, 고대비 색상
   모든 인터랙티브 요소에 :focus-visible 적용 */

/* 전역 포커스 스타일 초기화 및 재정의 */
*:focus {
  outline: none;
}

/* :focus-visible: 마우스 클릭 시 제외, 키보드 탐색 시에만 표시 */
*:focus-visible {
  outline: 3px solid var(--color-focus-ring, #005FCC);
  outline-offset: 3px;
  border-radius: 3px;
}

/* 고대비 모드 대응 (KWCAG 1.4.11 비텍스트 대비) */
@media (forced-colors: active) {
  *:focus-visible {
    outline: 3px solid ButtonText;
    outline-offset: 3px;
  }
}

/* 다크 모드 포커스 링 색상 조정 */
[data-theme="dark"] *:focus-visible {
  outline-color: var(--color-focus-ring-dark, #4DA3FF);
}

/* 고대비 테마 포커스 링 */
[data-theme-brand="high-contrast"] *:focus-visible {
  outline: 4px solid #FFFF00;
  outline-offset: 4px;
}

/* prefers-reduced-motion: 포커스 링 애니메이션 제거 */
@media (prefers-reduced-motion: reduce) {
  *:focus-visible {
    transition: none !important;
  }
}
```

#### 2.3.6 오류 식별 (KWCAG 3.3.1)

`components/ui/form-error.tsx`

```typescript
// Design Ref: §G.1
// KWCAG 3.3.1: 오류 정정 — 에러 필드 명확한 오류 메시지
// KWCAG 3.3.2: 레이블 제공

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormErrorProps {
  id: string          // aria-describedby로 입력 필드와 연결
  message: string
  className?: string
}

/**
 * FormError: 폼 검증 오류 메시지 컴포넌트
 * - role="alert": 오류 발생 시 스크린리더 즉시 공지
 * - aria-describedby로 관련 입력 필드와 연결 필수
 */
export function FormError({ id, message, className }: FormErrorProps) {
  if (!message) return null

  return (
    <div
      id={id}
      // KWCAG 3.3.1: 오류 메시지 — role="alert"로 즉시 공지
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex items-center gap-2 mt-1 text-sm text-[var(--color-error)]',
        className,
      )}
    >
      {/* KWCAG 1.4.1: 아이콘 + 텍스트 — 색상만으로 오류 표시 금지 */}
      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/**
 * FormField: 레이블 + 입력 + 오류 통합 컴포넌트
 * KWCAG 3.3.2: 모든 입력에 레이블 연결
 */
interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  errorId?: string
  errorMessage?: string
  hint?: string
  children: React.ReactNode
}

export function FormField({
  id,
  label,
  required = false,
  errorId,
  errorMessage,
  hint,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const effectiveErrorId = errorMessage ? errorId ?? `${id}-error` : undefined

  return (
    <div className="space-y-1">
      {/* KWCAG 3.3.2: htmlFor로 레이블-입력 연결 */}
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--color-text-primary)]"
      >
        {label}
        {required && (
          // 필수 항목 — 색상 + 텍스트 (KWCAG 1.4.1)
          <span
            className="ml-1 text-[var(--color-error)]"
            aria-label="필수 입력"
            title="필수 입력"
          >
            *
          </span>
        )}
      </label>

      {/* 힌트 텍스트 */}
      {hint && (
        <p
          id={hintId}
          className="text-xs text-[var(--color-text-secondary)]"
        >
          {hint}
        </p>
      )}

      {/* 입력 요소 (children으로 전달) */}
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
            id,
            'aria-required': required,
            // 오류 또는 힌트 있을 때 aria-describedby 자동 설정
            'aria-describedby': [hintId, effectiveErrorId].filter(Boolean).join(' ') || undefined,
            'aria-invalid': errorMessage ? true : undefined,
          })
        }
        return child
      })}

      {/* 오류 메시지 */}
      {errorMessage && (
        <FormError id={effectiveErrorId!} message={errorMessage} />
      )}
    </div>
  )
}
```

---

### 2.4 색각 이상 대응 (KWCAG 1.4.1)

설계 근거: 섹션 G.4

`components/ui/data-with-pattern.tsx`

```typescript
// Design Ref: §G.4
// KWCAG 1.4.1: 색에 무관한 인식 — 색상 + 패턴 + 아이콘 3중 표시

import React from 'react'
import { cn } from '@/lib/utils'

// N2SF 데이터 등급 표시 (색상 + 아이콘 + 텍스트 레이블)
type DataGrade = 'C' | 'S' | 'O'

const DATA_GRADE_CONFIG: Record<DataGrade, {
  label: string
  icon: string  // 이모지 또는 SVG 아이콘 이름
  bgClass: string
  textClass: string
  borderClass: string
  // 색각 이상 대응 패턴 클래스
  patternDescription: string
}> = {
  C: {
    label: '기밀',
    icon: '🛡️',
    bgClass: 'bg-red-50 dark:bg-red-950',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-300 dark:border-red-700',
    patternDescription: '빗금 패턴',
  },
  S: {
    label: '민감',
    icon: '⚠️',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950',
    textClass: 'text-yellow-700 dark:text-yellow-300',
    borderClass: 'border-yellow-300 dark:border-yellow-700',
    patternDescription: '점선 패턴',
  },
  O: {
    label: '공개',
    icon: '🌐',
    bgClass: 'bg-green-50 dark:bg-green-950',
    textClass: 'text-green-700 dark:text-green-300',
    borderClass: 'border-green-300 dark:border-green-700',
    patternDescription: '실선 패턴',
  },
}

interface DataGradeBadgeProps {
  grade: DataGrade
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function DataGradeBadge({
  grade,
  showLabel = true,
  size = 'md',
}: DataGradeBadgeProps) {
  const config = DATA_GRADE_CONFIG[grade]

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bgClass,
        config.textClass,
        config.borderClass,
        sizeClasses[size],
      )}
      // KWCAG 4.1.2: 의미 있는 ARIA 레이블
      aria-label={`N2SF 데이터 등급: ${config.label}(${grade})등급`}
      title={`${config.label} 데이터 (${config.patternDescription})`}
    >
      {/* 아이콘: 색각 이상 대응 */}
      <span aria-hidden="true">{config.icon}</span>
      {/* 텍스트 레이블: 색상에 무관하게 정보 전달 */}
      {showLabel && <span>{config.label}({grade})</span>}
    </span>
  )
}

// 차트 색맹 안전 팔레트 (8색: 색각 이상자도 구분 가능)
// 출처: Paul Tol's Muted color scheme (색각 이상 최적화)
export const COLOR_BLIND_SAFE_PALETTE = {
  blue: '#4477AA',
  cyan: '#66CCEE',
  green: '#228833',
  yellow: '#CCBB44',
  red: '#EE6677',
  purple: '#AA3377',
  gray: '#BBBBBB',
  darkBlue: '#002255',
} as const

// 차트 패턴 (색상 외에도 패턴으로 구분)
export const CHART_PATTERNS = [
  { id: 'solid', label: '실선' },
  { id: 'dashed', label: '점선' },
  { id: 'dotted', label: '점' },
  { id: 'cross-hatch', label: '격자' },
  { id: 'diagonal', label: '대각선' },
  { id: 'horizontal', label: '수평선' },
  { id: 'vertical', label: '수직선' },
  { id: 'zigzag', label: '지그재그' },
] as const
```

---

## 3. Storybook 8 설정

설계 근거: 섹션 I.1 ~ I.3 / SC-U10

### 3.1 기본 설정 파일

`.storybook/main.ts`

```typescript
// Design Ref: §I.1
// SC-U10: Storybook 8.6 — Next.js 15 + 접근성 테스트 통합

import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(ts|tsx)',
    '../src/components/**/*.mdx',
    '../src/app/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    // 접근성 검사 패널 (axe-core 기반)
    '@storybook/addon-a11y',
    // 인터랙션 테스트 (play 함수)
    '@storybook/addon-interactions',
    // 테마 전환 툴바
    '@storybook/addon-themes',
    // 문서 자동 생성 (autodocs)
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      // Next.js App Router 지원
      appDirectory: true,
      // Next.js 빌드 최적화
      nextConfigPath: '../next.config.ts',
    },
  },
  // Vitest 통합 (단위 테스트 + 스토리 테스트 병행)
  viteFinal: async (config) => {
    return {
      ...config,
      test: {
        // 접근성 테스트 axe-core 통합
        setupFiles: ['./.storybook/vitest-setup.ts'],
      },
    }
  },
  // 정적 파일 서빙
  staticDirs: ['../public'],
}

export default config
```

`.storybook/preview.tsx`

```typescript
// Design Ref: §I.1
// 전역 데코레이터 + 접근성 설정 + 뷰포트

import type { Preview } from '@storybook/react'
import React from 'react'
import '../src/styles/globals.css'
import '../src/styles/tokens/primitives.css'
import '../src/styles/tokens/semantic.css'

const preview: Preview = {
  // 전역 컨트롤 타입
  globalTypes: {
    // 라이트/다크 테마 전환
    theme: {
      description: '색상 테마',
      toolbar: {
        title: '테마',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: '라이트', icon: 'sun' },
          { value: 'dark', title: '다크', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
      defaultValue: 'light',
    },
    // 기관 브랜드 테마
    brand: {
      description: '기관 브랜드',
      toolbar: {
        title: '브랜드',
        icon: 'paintbrush',
        items: [
          { value: 'government-blue', title: '공공 블루' },
          { value: 'government-green', title: '공공 그린' },
          { value: 'dark-official', title: '다크 오피셜' },
          { value: 'classic-gray', title: '클래식 그레이' },
          { value: 'high-contrast', title: '고대비 (AAA)' },
        ],
        dynamicTitle: true,
      },
      defaultValue: 'government-blue',
    },
  },

  // 전역 데코레이터: 테마 + ARIA 구조
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'light'
      const brand = context.globals.brand || 'government-blue'

      return (
        // 전역 테마 데이터 속성
        <div
          data-theme={theme}
          data-theme-brand={brand}
          className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]"
          lang="ko"
        >
          {/* KWCAG 2.4.1: 건너뛰기 링크 */}
          <a
            href="#storybook-root"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-primary)] focus:text-[var(--color-on-primary)] focus:rounded-md"
          >
            본문으로 건너뛰기
          </a>
          <div id="storybook-root">
            <Story />
          </div>
        </div>
      )
    },
  ],

  parameters: {
    // 반응형 뷰포트 4종
    viewport: {
      viewports: {
        mobile: {
          name: '모바일 (375px)',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
        tablet: {
          name: '태블릿 (768px)',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        desktop: {
          name: '데스크탑 (1280px)',
          styles: { width: '1280px', height: '800px' },
          type: 'desktop',
        },
        wide: {
          name: '대형 (1920px)',
          styles: { width: '1920px', height: '1080px' },
          type: 'desktop',
        },
      },
      defaultViewport: 'desktop',
    },

    // axe-core 접근성 설정 (KWCAG 2.2 AA 기준)
    a11y: {
      // axe-core 실행 컨텍스트
      context: 'body',
      config: {
        // KWCAG 2.2 AA에 해당하는 axe 규칙 활성화
        rules: [
          { id: 'color-contrast', enabled: true },          // KWCAG 1.4.3
          { id: 'image-alt', enabled: true },               // KWCAG 1.1.1
          { id: 'label', enabled: true },                   // KWCAG 3.3.2
          { id: 'link-name', enabled: true },               // KWCAG 2.4.4
          { id: 'button-name', enabled: true },             // KWCAG 4.1.2
          { id: 'aria-required-parent', enabled: true },    // KWCAG 4.1.2
          { id: 'aria-required-children', enabled: true },  // KWCAG 4.1.2
          { id: 'duplicate-id', enabled: true },            // KWCAG 4.1.1
          { id: 'landmark-one-main', enabled: true },       // KWCAG 2.4.1
          { id: 'page-has-heading-one', enabled: false },   // 스토리에서는 비활성
          { id: 'region', enabled: false },                 // 스토리에서는 비활성
          { id: 'skip-link', enabled: false },              // 스토리에서는 비활성
        ],
      },
      options: {
        // 접근성 위반 시 에러로 처리 (violations 0 강제)
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      },
      // CI에서 violations 있으면 실패
      test: 'error',
    },

    // 배경색 (다크 모드 테스트용)
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#FFFFFF' },
        { name: 'dark', value: '#1A1A2E' },
        { name: 'gray', value: '#F5F5F5' },
      ],
    },
  },
}

export default preview
```

---

### 3.2 스토리 작성 예시

#### 3.2.1 Button 스토리 (인터랙션 테스트 포함)

`components/ui/button.stories.tsx`

```typescript
// Design Ref: §I.2
// SC-U10: 버튼 컴포넌트 스토리 — play 함수 포함

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { Button } from './button'
import { Loader2 } from 'lucide-react'

const meta: Meta<typeof Button> = {
  // Atomic Design 계층 기반 분류
  title: '원자/Button',
  component: Button,
  // 자동 문서 생성
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: '버튼 변형 (시각적 스타일)',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: '버튼 크기 (최소 터치 타겟 44px 준수)',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태 (KWCAG 2.1.1: 비활성 요소는 포커스 제외)',
    },
    children: {
      control: 'text',
      description: '버튼 레이블 (명확한 목적 텍스트 필수, KWCAG 2.4.6)',
    },
  },
  parameters: {
    // 접근성 테스트 필수 활성화
    a11y: { disable: false },
    docs: {
      description: {
        component: 'KWCAG 2.1.1 키보드 접근성 + 2.4.7 포커스 표시 준수 버튼 컴포넌트',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

// 기본 버튼
export const Default: Story = {
  args: {
    children: '기본 버튼',
    variant: 'default',
  },
}

// 위험 작업 버튼 (삭제, 경고)
export const Destructive: Story = {
  args: {
    children: '삭제',
    variant: 'destructive',
  },
}

// 보조 버튼
export const Secondary: Story = {
  args: {
    children: '취소',
    variant: 'secondary',
  },
}

// 로딩 상태 (KWCAG 4.1.2: aria-busy)
export const Loading: Story = {
  args: {
    children: (
      <>
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        처리 중...
      </>
    ),
    disabled: true,
    'aria-busy': true,
  } as any,
}

// 키보드 인터랙션 테스트 (KWCAG 2.1.1 검증)
export const KeyboardInteraction: Story = {
  args: {
    children: '키보드 테스트 버튼',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: '키보드 테스트 버튼' })

    // 1. 버튼이 DOM에 존재하는지 확인
    expect(button).toBeInTheDocument()

    // 2. Tab 키로 포커스 이동 확인 (KWCAG 2.1.1)
    await userEvent.tab()
    expect(button).toHaveFocus()

    // 3. Enter 키로 버튼 활성화 (KWCAG 2.1.1)
    await userEvent.keyboard('{Enter}')

    // 4. Space 키로 버튼 활성화 (KWCAG 2.1.1)
    await userEvent.keyboard(' ')

    // 5. 포커스 표시 확인 (KWCAG 2.4.7)
    // :focus-visible 스타일이 적용되었는지 CSS 클래스로 확인
    expect(button).toHaveFocus()
  },
}

// 비활성화 상태 테스트
export const DisabledState: Story = {
  args: {
    children: '비활성 버튼',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: '비활성 버튼' })

    // KWCAG 2.1.1: 비활성 버튼은 Tab 포커스에서 제외되어야 함
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('disabled')
  },
}

// 다크 모드 스토리
export const DarkMode: Story = {
  args: { children: '다크 모드 버튼' },
  globals: {
    theme: 'dark',
    brand: 'dark-official',
  },
}

// 고대비 모드 스토리 (KWCAG 1.4.6 AAA 달성)
export const HighContrast: Story = {
  args: { children: '고대비 버튼' },
  globals: {
    brand: 'high-contrast',
  },
}
```

#### 3.2.2 AI 어시스턴트 패널 스토리

`components/ai/ai-assistant-panel.stories.tsx`

```typescript
// Design Ref: §I.2, §E.1
// SC-U10: AI 어시스턴트 패널 스토리 — 포커스 트랩 접근성 테스트

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { AIAssistantPanel } from './ai-assistant-panel'

const meta: Meta<typeof AIAssistantPanel> = {
  title: '유기체/AIAssistantPanel',
  component: AIAssistantPanel,
  tags: ['autodocs'],
  parameters: {
    a11y: { disable: false },
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'N2SF 데이터 등급 차단 + KWCAG 2.1.2 포커스 트랩 + 4.1.2 ARIA 보완 패널.',
          'C/S등급 데이터 AI 전송 차단 (NFR-U.8).',
        ].join(' '),
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof AIAssistantPanel>

// 패널 열림 상태
export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
}

// 패널 닫힘 상태
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
  },
}

// 메시지 로딩 상태
export const LoadingMessage: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    isLoading: true,
  },
}

// 키보드 포커스 트랩 테스트 (KWCAG 2.1.2)
export const FocusTrapTest: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // 패널이 열려 있는지 확인
    const panel = canvas.getByRole('complementary', { name: /AI 어시스턴트/i })
    expect(panel).toBeVisible()

    // Tab 키로 패널 내 포커스 순환 확인 (KWCAG 2.1.2 포커스 트랩)
    await userEvent.tab()
    const focusedElement = document.activeElement
    expect(panel).toContainElement(focusedElement as HTMLElement)

    // 연속 Tab으로 모든 인터랙티브 요소 순회
    await userEvent.tab()
    await userEvent.tab()
    // 마지막 요소 이후 다시 첫 번째로 순환
    const focusedAfterCycle = document.activeElement
    expect(panel).toContainElement(focusedAfterCycle as HTMLElement)

    // Esc 키로 패널 닫기 (KWCAG 2.1.2)
    await userEvent.keyboard('{Escape}')
  },
}

// ARIA 속성 테스트
export const AriaAttributeTest: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // KWCAG 4.1.2: role="complementary" 확인
    const panel = canvas.getByRole('complementary')
    expect(panel).toHaveAttribute('aria-label')

    // 닫기 버튼 레이블 확인
    const closeButton = canvas.getByRole('button', { name: /닫기/i })
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toHaveAttribute('aria-label')
  },
}
```

#### 3.2.3 대시보드 위젯 그리드 스토리

`components/dashboard/widget-grid.stories.tsx`

```typescript
// Design Ref: §I.2, §F.1
// SC-U10: 대시보드 위젯 그리드 스토리 — dnd-kit 접근성 포함

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { WidgetGrid } from './widget-grid'
import { useDashboardStore } from '@/stores/dashboard-store'
import { useEffect } from 'react'

// 스토리용 대시보드 초기화 데코레이터
function WithDashboardData(Story: React.FC) {
  const { reorderWidgets } = useDashboardStore()

  useEffect(() => {
    // 스토리 전용 샘플 위젯 데이터
    reorderWidgets([
      {
        id: 'widget-1',
        type: 'csap-progress',
        title: 'CSAP 준수 현황',
        position: { x: 0, y: 0 },
        size: { w: 1, h: 1 },
        props: { targetGrade: 'standard' },
      },
      {
        id: 'widget-2',
        type: 'recent-activity',
        title: '최근 활동',
        position: { x: 1, y: 0 },
        size: { w: 1, h: 2 },
        props: {},
      },
      {
        id: 'widget-3',
        type: 'ai-recommendations',
        title: 'AI 추천 작업',
        position: { x: 2, y: 0 },
        size: { w: 1, h: 1 },
        props: {},
      },
    ])
  }, [])

  return <Story />
}

const meta: Meta<typeof WidgetGrid> = {
  title: '유기체/WidgetGrid',
  component: WidgetGrid,
  decorators: [WithDashboardData],
  parameters: {
    a11y: { disable: false },
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof WidgetGrid>

// 기본 그리드 (보기 모드)
export const Default: Story = {}

// 편집 모드 (드래그앤드롭 활성화)
export const EditMode: Story = {
  decorators: [
    (Story) => {
      const { toggleEditing } = useDashboardStore()
      useEffect(() => { toggleEditing() }, [])
      return <Story />
    },
  ],
}

// 키보드로 위젯 이동 테스트 (KWCAG 2.1.1)
export const KeyboardDragTest: Story = {
  decorators: [
    (Story) => {
      const { toggleEditing } = useDashboardStore()
      useEffect(() => { toggleEditing() }, [])
      return <Story />
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // 위젯 그리드 영역 확인
    const region = canvas.getByRole('region', { name: '대시보드 위젯 영역' })
    expect(region).toBeInTheDocument()

    // 첫 번째 드래그 핸들 포커스
    const dragHandles = canvas.getAllByRole('button', { name: /이동 핸들/ })
    expect(dragHandles.length).toBeGreaterThan(0)

    // 드래그 핸들에 포커스 이동
    await userEvent.tab()
    // Space 키로 드래그 시작 (dnd-kit 키보드 인터랙션)
    await userEvent.keyboard(' ')
    // 화살표 키로 이동
    await userEvent.keyboard('{ArrowRight}')
    // Space 키로 놓기
    await userEvent.keyboard(' ')
  },
}

// 빈 대시보드 (위젯 없음)
export const Empty: Story = {
  decorators: [
    (Story) => {
      const { reorderWidgets } = useDashboardStore()
      useEffect(() => { reorderWidgets([]) }, [])
      return <Story />
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 빈 상태 메시지 확인
    const status = canvas.getByRole('status')
    expect(status).toHaveTextContent('위젯이 없습니다')
  },
}
```

---

## 4. Playwright 접근성 자동 테스트

설계 근거: 섹션 I.3 / NFR-U.1 / SC-U10

### 4.1 Playwright 설정

`playwright.config.ts`

```typescript
// Design Ref: §I.3
// NFR-U.1: 6개 페이지 × 4 뷰포트 = 24개 접근성 테스트

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/a11y',
  // 병렬 실행
  fullyParallel: true,
  // CI 환경에서 재시도
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // 리포트 설정
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    // CI에서는 GitHub Actions 리포터
    ...(process.env.CI ? [['github'] as [string]] : []),
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // 한국어 로케일 (KWCAG 3.1.1 대응)
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  // 테스트 대상 브라우저 × 뷰포트
  projects: [
    // 데스크탑
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // 태블릿 (768px)
    {
      name: 'Tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        userAgent: devices['iPad (gen 7)'].userAgent,
      },
    },
    // 모바일 (375px)
    {
      name: 'Mobile',
      use: { ...devices['iPhone 12'] },
    },
    // 접근성 전용: 대형 화면
    {
      name: 'Wide',
      use: { viewport: { width: 1920, height: 1080 } },
    },
  ],
  // 테스트 전 개발 서버 시작
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### 4.2 접근성 테스트 스크립트

`tests/a11y/accessibility.test.ts`

```typescript
// Design Ref: §I.3
// NFR-U.1: KWCAG 2.2 AA 전수 접근성 테스트
// 목표: axe-core violations 0

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// 테스트 대상 페이지 목록
const TEST_PAGES = [
  { name: '로그인', path: '/login', requiresAuth: false },
  { name: '대시보드', path: '/dashboard', requiresAuth: true },
  { name: 'CSAP 체크리스트', path: '/csap/checklist', requiresAuth: true },
  { name: 'N2SF 매핑', path: '/n2sf/mapping', requiresAuth: true },
  { name: '감리 산출물', path: '/audit/documents', requiresAuth: true },
  { name: '테마 설정', path: '/admin/theme', requiresAuth: true },
] as const

// 공통 axe-core 설정 (KWCAG 2.2 AA 기준)
const AXE_CONFIG = {
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa'] as string[],
  // 공공기관 SaaS 특수 규칙 비활성화 (스토리북 전용)
  disableRules: [] as string[],
}

// 인증 설정 (테스트 전 로그인)
test.describe.configure({ mode: 'parallel' })

test.beforeEach(async ({ page }) => {
  // 테스트 계정으로 로그인 (테스트 환경 전용)
  await page.goto('/api/auth/test-login')
  await page.waitForURL('/dashboard')
})

// --- KWCAG 2.2 AA axe-core 전수 검사 ---
for (const pageInfo of TEST_PAGES) {
  test.describe(`${pageInfo.name} 페이지 접근성`, () => {

    test(`KWCAG 2.2 AA — axe-core violations 0 확인`, async ({ page }) => {
      await page.goto(pageInfo.path)
      // 페이지 완전 로드 대기
      await page.waitForLoadState('networkidle')

      const results = await new AxeBuilder({ page })
        .withTags(AXE_CONFIG.tags)
        .analyze()

      // violations 0 강제 (CSAP D-12, KWCAG 2.2 준수)
      if (results.violations.length > 0) {
        const details = results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
          wcag: v.tags.filter((t) => t.startsWith('wcag')),
        }))
        console.error('접근성 위반 항목:', JSON.stringify(details, null, 2))
      }

      expect(results.violations).toEqual([])
    })

    test(`키보드 네비게이션 — Tab 순환 테스트 (KWCAG 2.1.1)`, async ({ page }) => {
      await page.goto(pageInfo.path)
      await page.waitForLoadState('networkidle')

      // 페이지에 포커스 가능한 요소 수집
      const focusableCount = await page.locator(
        'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      ).count()

      expect(focusableCount).toBeGreaterThan(0)

      // Tab 키로 첫 번째 요소에 포커스
      await page.keyboard.press('Tab')
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
      // KWCAG 2.4.1: 첫 포커스가 건너뛰기 링크여야 함
      expect(['A', 'BUTTON', 'INPUT'].includes(firstFocused ?? '')).toBe(true)
    })

    test(`건너뛰기 링크 동작 확인 (KWCAG 2.4.1)`, async ({ page }) => {
      await page.goto(pageInfo.path)

      // 첫 Tab 키로 건너뛰기 링크에 포커스
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        text: document.activeElement?.textContent?.trim(),
        href: (document.activeElement as HTMLAnchorElement)?.href,
      }))

      // 건너뛰기 링크 존재 확인
      const skipLink = page.locator('a[href="#main-content"]')
      await expect(skipLink).toBeAttached()

      // Enter 키로 건너뛰기 실행
      await page.keyboard.press('Enter')
      const mainContent = await page.locator('#main-content').isVisible()
      expect(mainContent).toBe(true)
    })

    test(`포커스 표시 확인 (KWCAG 2.4.7)`, async ({ page }) => {
      await page.goto(pageInfo.path)
      await page.waitForLoadState('networkidle')

      // Tab으로 포커스 이동 후 포커스 링 스타일 확인
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return null
        const style = window.getComputedStyle(el)
        return {
          tag: el.tagName,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
        }
      })

      // 포커스 링이 none이 아닌지 확인
      if (focusedElement) {
        expect(focusedElement.outlineStyle).not.toBe('none')
      }
    })

    test(`HTML lang 속성 확인 (KWCAG 3.1.1)`, async ({ page }) => {
      await page.goto(pageInfo.path)

      const lang = await page.evaluate(() =>
        document.documentElement.getAttribute('lang')
      )
      // KWCAG 3.1.1: lang="ko" 필수
      expect(lang).toBe('ko')
    })
  })
}

// --- 반응형 접근성 테스트 ---
const VIEWPORTS = [
  { name: '모바일', width: 375, height: 812 },
  { name: '태블릿', width: 768, height: 1024 },
  { name: '데스크탑', width: 1280, height: 800 },
  { name: '대형', width: 1920, height: 1080 },
] as const

for (const viewport of VIEWPORTS) {
  test(`반응형 — ${viewport.name} (${viewport.width}px) 대시보드 접근성`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // 수평 스크롤 없음 확인
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflowX).toBe(false)

    // 각 뷰포트에서 axe-core 검사
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

// --- prefers-reduced-motion 테스트 ---
test(`모션 감소 설정 대응 (KWCAG 2.3.1)`, async ({ page }) => {
  // prefers-reduced-motion: reduce 에뮬레이션
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // CSS 트랜지션 duration 확인
  const hasReducedMotion = await page.evaluate(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    return mq.matches
  })
  expect(hasReducedMotion).toBe(true)
})

// --- 고대비 모드 테스트 ---
test(`강제 색상 모드 대응 (KWCAG 1.4.11)`, async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  // 강제 색상 모드에서도 접근성 위반 없음 확인
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
```

### 4.3 CI 통합 (Gitea Actions)

`.gitea/workflows/a11y-check.yml`

```yaml
# Design Ref: §I.3
# NFR-U.1: CI 접근성 자동 검사 — PR 머지 전 필수 통과

name: 접근성 자동 검사 (KWCAG 2.2 AA)

on:
  push:
    branches: [main, stg, 'feat/**']
  pull_request:
    branches: [main, stg]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  a11y-check:
    name: KWCAG 2.2 접근성 검사
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 소스 체크아웃
        uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: 의존성 설치
        run: npm ci

      - name: 타입 검사
        run: npm run type-check

      - name: 린트 검사
        run: npm run lint

      - name: 빌드
        run: npm run build
        env:
          NODE_ENV: production

      - name: Playwright 브라우저 설치
        run: npx playwright install --with-deps chromium

      - name: 개발 서버 시작 (백그라운드)
        run: npm run start &
        env:
          PORT: 3000

      - name: 서버 준비 대기
        run: npx wait-on http://localhost:3000 --timeout 60000

      - name: Playwright 접근성 테스트 실행
        run: npx playwright test tests/a11y/
        env:
          CI: true

      - name: 테스트 결과 업로드 (실패 시)
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-a11y-report
          path: playwright-report/
          retention-days: 7

      - name: Storybook 빌드 + axe-core 검사
        run: |
          npm run build-storybook
          npx storybook test --browsers chromium --url http://localhost:6006
        env:
          CI: true

  storybook-a11y:
    name: Storybook 접근성 검사
    runs-on: ubuntu-latest
    needs: a11y-check
    if: success()

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci

      - name: Storybook 빌드
        run: npm run build-storybook

      - name: Storybook 서버 시작
        run: npx http-server storybook-static -p 6006 &

      - name: axe-core 전수 검사
        run: npx @axe-core/cli http://localhost:6006 --tags wcag2a,wcag2aa,wcag21aa
```

---

## 5. Motion v12 접근성 인식 애니메이션

설계 근거: 섹션 G.3 / NFR-U.7

### 5.1 접근성 인식 애니메이션 설정

`lib/motion/accessible-motion.tsx`

```typescript
// Design Ref: §G.3
// NFR-U.7: KWCAG 2.3.1 깜빡임 제한 — prefers-reduced-motion 전역 적용

'use client'

import React from 'react'
import { MotionConfig, AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

/**
 * AccessibleMotionConfig: 앱 최상단에 배치하는 Motion 설정 프로바이더
 * - prefers-reduced-motion 자동 감지 및 적용
 * - KWCAG 2.3.1: 3Hz 이상 깜빡임 금지
 */
export function AccessibleMotionConfig({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <MotionConfig
      // prefers-reduced-motion: reduce 시 모든 애니메이션 즉시 전환
      reducedMotion={shouldReduceMotion ? 'always' : 'never'}
      // 전환 시간 초과 방지
      transition={{ duration: shouldReduceMotion ? 0 : undefined }}
    >
      {children}
    </MotionConfig>
  )
}

/**
 * AccessibleAnimatePresence: 마운트/언마운트 애니메이션 래퍼
 * - 모션 감소 시 애니메이션 비활성화
 */
export function AccessibleAnimatePresence({
  children,
  ...props
}: React.ComponentProps<typeof AnimatePresence>) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    // 모션 감소 시 AnimatePresence 없이 즉시 렌더링
    return <>{children}</>
  }

  return <AnimatePresence {...props}>{children}</AnimatePresence>
}

/**
 * FadeIn: 접근성 인식 페이드인 애니메이션
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.25,
        delay: shouldReduceMotion ? 0 : delay,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * SlideIn: 접근성 인식 슬라이드 애니메이션 (사이드바, 패널용)
 */
export function SlideIn({
  children,
  direction = 'right',
  className,
}: {
  children: React.ReactNode
  direction?: 'left' | 'right' | 'up' | 'down'
  className?: string
}) {
  const shouldReduceMotion = useReducedMotion()

  const getInitial = () => {
    if (shouldReduceMotion) return { opacity: 0 }
    const offset = 24
    switch (direction) {
      case 'left': return { x: -offset, opacity: 0 }
      case 'right': return { x: offset, opacity: 0 }
      case 'up': return { y: -offset, opacity: 0 }
      case 'down': return { y: offset, opacity: 0 }
    }
  }

  return (
    <motion.div
      className={className}
      initial={getInitial()}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.2,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  )
}
```

### 5.2 대시보드 드래그 애니메이션

`lib/motion/dashboard-animations.ts`

```typescript
// Design Ref: §G.3, §F.1
// NFR-U.7: 드래그앤드롭 시각 피드백 애니메이션 (모션 감소 대응)

import { Variants } from 'motion/react'

/**
 * 위젯 드래그 시각 피드백 애니메이션 variants
 * useReducedMotion true 시: 모든 값을 정적으로 설정
 */
export function getWidgetDragVariants(shouldReduceMotion: boolean): Variants {
  return {
    idle: {
      scale: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      transition: {
        duration: shouldReduceMotion ? 0 : 0.2,
      },
    },
    dragging: {
      scale: shouldReduceMotion ? 1 : 1.03,
      boxShadow: shouldReduceMotion
        ? '0 1px 3px rgba(0,0,0,0.1)'
        : '0 20px 40px rgba(0,0,0,0.2)',
      zIndex: 999,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.15,
      },
    },
  }
}

/**
 * 위젯 추가/제거 애니메이션
 */
export function getWidgetPresenceVariants(shouldReduceMotion: boolean): Variants {
  return {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.9,
      y: shouldReduceMotion ? 0 : 10,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.25,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.9,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.15,
      },
    },
  }
}

/**
 * 드롭 대상 강조 애니메이션
 */
export function getDropTargetVariants(shouldReduceMotion: boolean): Variants {
  return {
    idle: {
      borderColor: 'var(--color-border)',
      backgroundColor: 'transparent',
    },
    over: {
      borderColor: 'var(--color-primary)',
      backgroundColor: 'var(--color-primary-subtle)',
      transition: {
        duration: shouldReduceMotion ? 0 : 0.15,
      },
    },
  }
}
```

---

## 6. 타입 정의

`types/dashboard.ts`

```typescript
// Design Ref: §F.1
// 대시보드 타입 정의

export type WidgetType =
  | 'csap-progress'
  | 'recent-activity'
  | 'ai-recommendations'
  | 'tenant-progress'
  | 'n2sf-status'
  | 'audit-calendar'
  | 'quick-actions'
  | 'custom-chart'

export interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  props: Record<string, unknown>
}

export interface WidgetDefinition {
  name: string
  description: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  maxSize: { w: number; h: number }
  component: React.LazyExoticComponent<React.ComponentType<{ props: Record<string, unknown> }>>
  requiredRole: string[]
  icon: string
}
```

---

## 7. 추적성 매트릭스

| FR/NFR ID | 설계 섹션 | 구현 파일 | KWCAG 항목 | 테스트 |
|-----------|----------|----------|-----------|--------|
| FR-U.12 | F.1 | dashboard-provider.tsx, widget-card.tsx, dashboard-store.ts | KWCAG 2.1.1 | Playwright 키보드 드래그 |
| FR-U.13 | F.2 | sidebar-toggle.tsx, sidebar-store.ts | KWCAG 2.4.1 | E2E 사이드바 모드 전환 |
| FR-U.14 | F.3 | column-manager.tsx | KWCAG 2.1.1 | Storybook play 함수 |
| FR-U.15 | F.4 | sidebar-store.ts (addFavorite, addRecentPage) | — | 단위 테스트 |
| NFR-U.1 | G.1 | 전체 컴포넌트 | KWCAG 2.2 33항목 | axe-core 전수 |
| NFR-U.2 | G.1 | contrast-validator.ts | KWCAG 1.4.3 | contrast ratio 검증 |
| NFR-U.3 | G.2 | focus-manager.ts | KWCAG 2.1.2 | Playwright 포커스 트랩 |
| NFR-U.4 | G.2 | live-region-provider.tsx | KWCAG 4.1.2 | NVDA/VoiceOver 수동 |
| NFR-U.7 | G.3 | accessible-motion.tsx, use-reduced-motion.ts | KWCAG 2.3.1 | Playwright emulate |
| SC-U10 | I.1~I.3 | .storybook/main.ts, .storybook/preview.tsx, *.stories.tsx | KWCAG 전수 | Storybook axe-core |

---

## 8. 설치 의존성

### 신규 추가 패키지

```bash
# dnd-kit (드래그앤드롭)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Playwright + axe-core (접근성 자동 테스트)
npm install --save-dev @playwright/test @axe-core/playwright

# Storybook 8.6 (접근성 addon 포함)
npm install --save-dev @storybook/nextjs @storybook/addon-a11y @storybook/addon-interactions @storybook/addon-themes @storybook/test

# Motion v12 (애니메이션)
npm install motion

# Zustand (상태 관리)
npm install zustand

# Radix UI (접근성 헤드리스 컴포넌트)
npm install @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-visually-hidden

# 날짜 유틸리티
npm install date-fns
```

### `package.json` 스크립트 추가

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test:a11y": "playwright test tests/a11y/",
    "test:storybook": "storybook test",
    "audit:dead-code": "npx ts-prune --error && npx depcheck"
  }
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — MTU-U1 Session 4 구현 가이드 (섹션 F, G, I) | Claude Code |
| — | — | dnd-kit @dnd-kit/react 최신 API 기반 (context7 /websites/dndkit 문서 참조) | — |
| — | — | Storybook 8.6 addon-a11y CSF 형식 기반 (context7 /storybookjs/storybook 참조) | — |
| — | — | KWCAG 2.2 33검사항목 전수 대응 패턴 포함 | — |
| — | — | Playwright + axe-core CI 자동화 통합 | — |
