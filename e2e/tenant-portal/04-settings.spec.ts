// Design Ref: MTU-E2E1 §TENANT-SETTINGS -- 테넌트 설정 페이지 테스트
// Plan SC: FR-QA-14 -- 테넌트 셀프서비스 설정 기능 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

test.describe('04. 테넌트 설정', () => {
  test('/tenant/settings 페이지 -- HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/tenant/settings`)
    expect(response?.status()).toBe(200)
  })

  test('테넌트 설정 페이지 -- 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/settings`)
    await page.waitForLoadState('networkidle')

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 설정 -- 설정 관련 컨텐츠 존재', async ({ page }) => {
    await page.goto(`${BASE}/tenant/settings`)
    await page.waitForLoadState('networkidle')

    const pageContent = await page.textContent('body')
    expect(pageContent).toBeDefined()
    const hasSettingsContent =
      pageContent?.includes('설정') ||
      pageContent?.includes('테넌트') ||
      pageContent?.includes('관리')
    expect(hasSettingsContent).toBe(true)
  })
})
