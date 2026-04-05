# MTU-U1-P: 플랫폼 포털 UI — Q-Gate 분석

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-U1-P |
| 분석일 | 2026-04-05 |

## FR 매치율

| FR ID | 요구사항 | 상태 | 구현 파일 |
|-------|---------|------|----------|
| FR-UP.1 | 서비스 레일 52px | PASS | ServiceRail.tsx |
| FR-UP.2 | 10개 초과 "더 보기" 팝오버 | PASS | ServiceRail.tsx |
| FR-UP.3 | FloatingSidebar 오버레이 전환 | PASS | AppShell.tsx + FloatingSidebar.tsx |
| FR-UP.4 | 테넌트 관리 페이지 (DataGrid) | PASS | TenantDataGrid.tsx |
| FR-UP.5 | 빌링 대시보드 | PASS | DashboardContent.tsx |
| FR-UP.6 | CSAP 준수 현황 | PASS | ComplianceMatrix.tsx + DashboardContent.tsx |
| FR-UP.7 | 서비스 카탈로그 | PASS | ServiceCatalogGrid.tsx |
| FR-UP.8 | 서비스 마켓플레이스 | PASS | ServiceMarketplace.tsx |
| FR-UP.9 | 구독 현황 허브 | PASS | ServiceMarketplace.tsx |
| FR-UP.10 | AppNavbar | PASS | AppNavbar.tsx |
| FR-UP.11 | DataGrid | PASS | DataGrid.tsx |
| FR-UP.12 | ServiceRail 유기체 | PASS | ServiceRail.tsx |
| FR-UP.13 | FloatingSidebar 유기체 | PASS | FloatingSidebar.tsx |
| FR-UP.14 | ComplianceMatrix | PASS | ComplianceMatrix.tsx |
| FR-UP.15 | AdminPageTemplate | PASS | AdminPageTemplate.tsx |
| FR-UP.16 | TenantPageTemplate | PASS | TenantPageTemplate.tsx |
| FR-UP.17 | DashboardTemplate | PASS | DashboardTemplate.tsx |
| FR-UP.18 | BottomTabBar | PASS | BottomTabBar.tsx |
| FR-UP.19 | SidebarBottomSheet | PASS | SidebarBottomSheet.tsx |
| FR-UP.20 | 감사 로그 Prisma DB 기록 | PASS | lib/audit.ts |
| FR-UP.21 | API 인증 + IDOR 수정 | PASS | 보안 가이드 적용 |
| FR-UP.22 | 레일 52px/200px 토글 | PASS | ServiceRail.tsx |
| FR-UP.23 | FloatingSidebar 핀/해제 | PASS | FloatingSidebar.tsx |
| FR-UP.24 | AI 우측 패널 (260~600px) | PASS | AiSidePanel.tsx |
| FR-UP.25 | 최근 방문 탭바 | PASS | RecentTabsBar.tsx |
| FR-UP.26 | 최근 표시 모드 설정 | PASS | RecentTabsBar.tsx |
| FR-UP.27 | 3단계 브레이크포인트 | PASS | AppShell.tsx CSS |

**매치율: 100% (27/27 FR PASS)**

## 컴포넌트 목록 (22개 파일)

- layout: AppShell, AppNavbar, ServiceRail, FloatingSidebar, RecentTabsBar (5종)
- admin: AdminPageTemplate, DashboardTemplate, DashboardContent, TenantDataGrid, ServiceCatalogGrid (5종)
- tenant: TenantPageTemplate, ServiceMarketplace (2종)
- common: DataGrid, ComplianceMatrix (2종)
- ai: AiSidePanel (1종)
- mobile: BottomTabBar, SidebarBottomSheet (2종)
- templates: AdminPageTemplate, TenantPageTemplate, DashboardTemplate (3종)
- lib: audit.ts (1종)
- app: layout.tsx, page.tsx (2종)
