// Design Ref: MTU-E2E1 §TENANT-SERVICES — 테넌트 서비스 목록 테스트
// Plan SC: FR-QA-9 — 테넌트 구독 서비스 허브 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

// 포털 샘플 서비스 목록
const SAMPLE_SERVICES = [
  { name: '전자결재', status: '활성', usage: '85%' },
  { name: '인사관리', status: '활성', usage: '72%' },
  { name: 'AI 업무지원', status: '활성', usage: '45%' },
]

test.describe('02. 테넌트 서비스 목록', () => {
  test('/tenant/services 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/tenant/services`)
    expect(response?.status()).toBe(200)
  })

  test('서비스 목록 페이지 — 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    const title = page.getByText('구독 서비스')
    await expect(title.first()).toBeVisible({ timeout: 10000 })
  })

  test('서비스 목록 — 페이지 설명 텍스트', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    const description = page.getByText('활성화된 서비스를 관리하세요')
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })

  test('서비스 목록 — 전자결재 서비스 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    const serviceName = page.getByText('전자결재')
    await expect(serviceName.first()).toBeVisible({ timeout: 10000 })
  })

  test('서비스 목록 — 인사관리 서비스 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    const serviceName = page.getByText('인사관리')
    await expect(serviceName.first()).toBeVisible({ timeout: 10000 })
  })

  test('서비스 목록 — AI 업무지원 서비스 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    const serviceName = page.getByText('AI 업무지원')
    await expect(serviceName.first()).toBeVisible({ timeout: 10000 })
  })

  test('서비스 목록 — 활성 상태 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    // 서비스 카드에 '활성' 상태 표시
    const activeStatus = page.getByText('활성').first()
    await expect(activeStatus).toBeVisible({ timeout: 10000 })
  })

  test('서비스 목록 — 사용량 표시 (85%, 72%, 45%)', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    const usages = ['85%', '72%', '45%']
    for (const usage of usages) {
      const usageElement = page.getByText(`사용량: ${usage}`)
      await expect(usageElement.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('서비스 목록 — 3개 서비스 카드 모두 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/services`)
    await page.waitForLoadState('networkidle')

    for (const service of SAMPLE_SERVICES) {
      const serviceCard = page.getByText(service.name)
      await expect(serviceCard.first()).toBeVisible({ timeout: 10000 })
    }
  })
})
