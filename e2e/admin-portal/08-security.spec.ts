// Design Ref: MTU-E2E1 §SECURITY -- 보안 모니터링 페이지 테스트
// Plan SC: FR-QA-13 -- CSAP D-06/D-08 보안 모니터링 UI 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

test.describe('08. 보안 모니터링', () => {
  test('/admin/security 페이지 -- HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/security`)
    expect(response?.status()).toBe(200)
  })

  test('보안 모니터링 페이지 -- 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/security`)
    await page.waitForLoadState('networkidle')

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('보안 모니터링 -- 페이지 내 보안 관련 컨텐츠 존재', async ({ page }) => {
    await page.goto(`${BASE}/admin/security`)
    await page.waitForLoadState('networkidle')

    const pageContent = await page.textContent('body')
    expect(pageContent).toBeDefined()
    // 보안 모니터링 페이지이므로 보안 관련 텍스트 존재
    const hasSecurityContent =
      pageContent?.includes('보안') ||
      pageContent?.includes('로그인') ||
      pageContent?.includes('감시') ||
      pageContent?.includes('이상')
    expect(hasSecurityContent).toBe(true)
  })
})
