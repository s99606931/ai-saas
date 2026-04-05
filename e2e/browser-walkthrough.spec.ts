// 브라우저 전체 화면 워크스루 — 실제 디자인 확인용
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

test.use({ viewport: { width: 1280, height: 800 } })

test('01. 관리자 대시보드', async ({ page }) => {
  await page.goto(`${BASE}/admin/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/01-admin-dashboard.png', fullPage: false })
  await expect(page.getByText('플랫폼 대시보드')).toBeVisible()
})

test('02. 테넌트 관리', async ({ page }) => {
  await page.goto(`${BASE}/admin/tenants`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/02-admin-tenants.png', fullPage: false })
  await expect(page.getByRole('heading', { name: '테넌트 관리' })).toBeVisible()
})

test('03. 사용자 관리', async ({ page }) => {
  await page.goto(`${BASE}/admin/users`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/03-admin-users.png', fullPage: false })
  await expect(page.getByText('사용자 관리')).toBeVisible()
})

test('04. CSAP 준수 현황', async ({ page }) => {
  await page.goto(`${BASE}/admin/compliance`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/04-admin-compliance.png', fullPage: false })
  await expect(page.getByText('CSAP 79항목')).toBeVisible()
})

test('05. 테넌트 대시보드', async ({ page }) => {
  await page.goto(`${BASE}/tenant/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/05-tenant-dashboard.png', fullPage: false })
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
})

test('06. 구독 서비스 목록', async ({ page }) => {
  await page.goto(`${BASE}/tenant/services`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/06-tenant-services.png', fullPage: false })
  await expect(page.getByText('구독 서비스')).toBeVisible()
})

test('07. 서비스 마켓플레이스', async ({ page }) => {
  await page.goto(`${BASE}/tenant/marketplace`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e-screenshots/07-tenant-marketplace.png', fullPage: false })
  await expect(page.getByText('서비스 마켓플레이스')).toBeVisible()
})

test('08. API 헬스체크', async ({ request }) => {
  const apis = [
    '/api/dashboard/stats',
    '/api/tenants',
    '/api/users',
    '/api/compliance/csap',
    '/api/subscriptions',
    '/api/audit-logs',
  ]
  for (const api of apis) {
    const res = await request.get(`${BASE}${api}`)
    expect([200, 404]).toContain(res.status())
    console.log(`${api} → ${res.status()}`)
  }
})
