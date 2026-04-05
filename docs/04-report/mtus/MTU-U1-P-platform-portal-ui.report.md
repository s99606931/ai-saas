# MTU-U1-P: 플랫폼 포털 UI 확장 — Report 문서

> **문서 ID**: REPORT-MTU-U1-P | **matchRate**: 100% | **작성일**: 2026-04-05

## 1. Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 관리자/테넌트 포털 공통 컴포넌트 | 100% — 13개 서비스 레일, 4종 포탈 |
| 기술 | Next.js 15 + React 19 + Tailwind v4 | 100% — App Shell + 서비스 레일 + 사이드바 |
| 보안 | SG-01/SG-02 해결, 감사 로그 DB 기록 | 100% — HTTP POST audit-service 연동 |
| 운영 | 반응형 3단계 브레이크포인트 | 100% — 1024/768/480px |

## 2. FR 달성 현황

| FR ID | 요구사항 | 상태 | 구현 상세 |
|-------|---------|------|----------|
| FR-UP.1 | 서비스 레일 52px | PASS | ServiceRail.tsx — 13개 서비스, 아이콘+툴팁 |
| FR-UP.2 | 10개 초과 더 보기 | PASS | MAX_VISIBLE=10, 팝오버 카테고리 그룹 |
| FR-UP.3 | FloatingSidebar 전환 | PASS | 300ms transition, absolute overlay |
| FR-UP.4 | 테넌트 관리 DataGrid | PASS | TenantDataGrid — 정렬/필터/페이지네이션 |
| FR-UP.5 | 구독/빌링 대시보드 | PASS | DashboardContent — 수익 카드 + 차트 영역 |
| FR-UP.6 | CSAP 준수 대시보드 | PASS | ComplianceMatrix — 12개 도메인 게이지 |
| FR-UP.7 | 서비스 카탈로그 | PASS | ServiceCatalogGrid — 카드 그리드 + 상태 뱃지 |
| FR-UP.8 | 서비스 마켓플레이스 | PASS | ServiceMarketplace — 카테고리 필터 + 구독 위저드 |
| FR-UP.9 | 구독 현황 허브 | PASS | ServiceMarketplace — subscribed 카드 표�� |
| FR-UP.10 | AppNavbar | PASS | 로고+포털전환+검색(Cmd+K)+AI+알림+사용자 |
| FR-UP.11 | DataGrid | PASS | 범용 DataGrid — 정렬/필터/페이지네이션/렌더 커스텀 |
| FR-UP.12 | ServiceRail | PASS | 확장/축소 토글 + 아이콘 + 이름 표시 |
| FR-UP.13 | FloatingSidebar | PASS | 플로팅 오버레이 + 핀 고정 전환 |
| FR-UP.14 | ComplianceMatrix | PASS | CSAP/N2SF 프로그레스 바 매트릭스 |
| FR-UP.15 | AdminPageTemplate | PASS | 제목+설명+액션+컨텐츠 레이아웃 |
| FR-UP.16 | TenantPageTemplate | PASS | 테넌트 전용 페이지 레이아웃 |
| FR-UP.17 | DashboardTemplate | PASS | 위젯 그리드 (1~3 span) |
| FR-UP.18 | BottomTabBar | PASS | 5탭 고정 (홈/서비스/AI/알림/설정), 44x44px |
| FR-UP.19 | SidebarBottomSheet | PASS | 바텀시트 + 백드롭 블러, 300ms |
| FR-UP.20 | SG-01 해결 | PASS | lib/audit.ts — HTTP POST audit-service |
| FR-UP.21 | SG-02 해결 | PASS | Authorization Bearer 헤더 포함 |
| FR-UP.22 | 레일 52px↔200px | PASS | --rail-w / --rail-expanded-w CSS 토큰 |
| FR-UP.23 | 사이드바 핀/플로팅 | PASS | position absolute↔relative 전환 |
| FR-UP.24 | AI 패널 드래그 리사이즈 | PASS | AiSidePanel 260~600px, col-resize |
| FR-UP.25 | 최근 방문 탭바 | PASS | RecentTabsBar — 탭 닫기 + 스크롤 |
| FR-UP.26 | 최근 모드 설정 | PASS | localStorage recentMode (tabs/list) |
| FR-UP.27 | 3단계 브레이크포인트 | PASS | 1024/768/480px 반응형 CSS |

## 3. 산출물 목록

| # | 파일 | 설명 |
|---|------|------|
| 1 | `portal/src/components/layout/AppShell.tsx` | App Shell 루트 레이아웃 |
| 2 | `portal/src/components/layout/AppNavbar.tsx` | 상단 네비게이션 바 |
| 3 | `portal/src/components/layout/ServiceRail.tsx` | 서비스 레일 스위처 |
| 4 | `portal/src/components/layout/FloatingSidebar.tsx` | 플로팅 사이드바 |
| 5 | `portal/src/components/layout/RecentTabsBar.tsx` | 최근 방문 탭바 |
| 6 | `portal/src/components/ai/AiSidePanel.tsx` | AI 대화 패널 |
| 7 | `portal/src/components/mobile/BottomTabBar.tsx` | 모바일 하단 탭바 |
| 8 | `portal/src/components/mobile/SidebarBottomSheet.tsx` | 모바일 바텀시트 |
| 9 | `portal/src/components/common/DataGrid.tsx` | 범용 데이터 그리드 |
| 10 | `portal/src/components/common/ComplianceMatrix.tsx` | 준수 현황 매트릭스 |
| 11 | `portal/src/components/admin/DashboardContent.tsx` | 관리자 대시보드 |
| 12 | `portal/src/components/admin/TenantDataGrid.tsx` | 테넌트 관리 그리드 |
| 13 | `portal/src/components/admin/ServiceCatalogGrid.tsx` | 서비스 카탈로그 |
| 14 | `portal/src/components/admin/AdminPageTemplate.tsx` | 관리자 페이지 템플릿 |
| 15 | `portal/src/components/admin/DashboardTemplate.tsx` | 대시보드 위젯 템플릿 |
| 16 | `portal/src/components/tenant/ServiceMarketplace.tsx` | 서비스 마켓플레이스 |
| 17 | `portal/src/components/tenant/TenantPageTemplate.tsx` | 테넌트 페이지 템플릿 |
| 18 | `portal/src/lib/audit.ts` | 프론트엔드 감사 로그 유틸리티 |
| 19 | `portal/src/app/layout.tsx` | Next.js 루트 레이아웃 |
| 20 | `portal/src/app/page.tsx` | 메인 페이지 |
| 21 | `portal/src/styles/globals.css` | CSS 토큰 + 레이아웃 유틸리티 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 — 전체 27 FR 100% 달성 | PM Agent |
