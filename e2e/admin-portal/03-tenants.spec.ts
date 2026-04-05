// Design Ref: MTU-E2E1 §TENANTS — 테넌트 관리 페이지 테스트
// Plan SC: FR-QA-5 — 테넌트 목록 및 관리 기능 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

// 포털에 등록된 샘플 테넌트명
const EXPECTED_TENANTS = ['서울시청', '부산시청', '국세청', '환경부']

test.describe('03. 테넌트 관리', () => {
  test('/admin/tenants 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/tenants`)
    expect(response?.status()).toBe(200)
  })

  test('테넌트 목록 페이지 — 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    // 페이지 제목 확인
    const title = page.getByText('테넌트 관리')
    await expect(title.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 목록 — 서울시청 테넌트 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const tenantName = page.getByText('서울시청')
    await expect(tenantName.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 목록 — 부산시청 테넌트 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const tenantName = page.getByText('부산시청')
    await expect(tenantName.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 목록 — 국세청 테넌트 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const tenantName = page.getByText('국세청')
    await expect(tenantName.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 목록 — 상태(ACTIVE) 컬럼 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const activeStatus = page.getByText('ACTIVE').first()
    await expect(activeStatus).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 목록 — 요금제 컬럼 표시 (Enterprise/Standard/Trial)', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const enterprisePlan = page.getByText('Enterprise').first()
    await expect(enterprisePlan).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 목록 — 등록일 컬럼 헤더 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const dateHeader = page.getByText('등록일')
    await expect(dateHeader.first()).toBeVisible({ timeout: 10000 })
  })

  test('API — /api/tenants 응답 검증', async ({ request }) => {
    const response = await request.get(`${BASE}/api/tenants`)
    if (response.status() === 200) {
      const data = await response.json()
      expect(typeof data).toBe('object')
      if ('tenants' in data && Array.isArray(data.tenants)) {
        expect(data.tenants.length).toBeGreaterThan(0)
      }
      if ('total' in data) {
        expect(data.total).toBeGreaterThanOrEqual(0)
      }
    } else {
      // Static 포털에서는 API 미구현 허용
      expect([404, 405]).toContain(response.status())
    }
  })

  test('테넌트 목록 — 페이지 설명 텍스트 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/tenants`)
    await page.waitForLoadState('networkidle')

    const description = page.getByText('플랫폼에 등록된 테넌트를 관리합니다')
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })
})
