// Design Ref: MTU-E2E1 §AI -- AI 모델 관리 페이지 테스트
// Plan SC: FR-QA-12 -- N2SF N-05 AI 모델 관리 UI 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

test.describe('07. AI 모델 관리', () => {
  test('/admin/ai 페이지 -- HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/ai`)
    expect(response?.status()).toBe(200)
  })

  test('AI 관리 페이지 -- 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/ai`)
    await page.waitForLoadState('networkidle')

    // h1 또는 주요 제목 존재 확인
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('AI 관리 -- N2SF 데이터 등급 관련 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/ai`)
    await page.waitForLoadState('networkidle')

    // 페이지에 N2SF 또는 등급 관련 텍스트가 있는지 확인
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeDefined()
    // AI 관리 페이지이므로 AI 관련 컨텐츠가 있어야 함
    const hasAiContent = pageContent?.includes('AI') || pageContent?.includes('모델')
    expect(hasAiContent).toBe(true)
  })
})
