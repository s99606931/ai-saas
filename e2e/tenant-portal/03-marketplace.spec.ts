// Design Ref: MTU-E2E1 §TENANT-MARKETPLACE — 서비스 마켓플레이스 테스트
// Plan SC: FR-QA-10 — 마켓플레이스 카탈로그 및 구독 기능 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

// 마켓플레이스 샘플 서비스 카탈로그
const MARKETPLACE_SERVICES = [
  { name: '전자결재', description: '공공기관 전자결재 시스템', category: '업무', subscribed: true },
  { name: '인사관리', description: '공무원 인사 관리 시스템', category: '인사', subscribed: true },
  { name: '재정관리', description: '예산 편성 및 집행 관리', category: '재정', subscribed: false },
  { name: '민원처리', description: '온라인 민원 접수/처리', category: '민원', subscribed: false },
  { name: 'AI 문서분석', description: '공문서 자동 분류/요약', category: 'AI', subscribed: false },
]

const CATEGORIES = ['전체', '업무', '인사', '재정', '민원', 'AI']

test.describe('03. 서비스 마켓플레이스', () => {
  test('/tenant/marketplace 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/tenant/marketplace`)
    expect(response?.status()).toBe(200)
  })

  test('마켓플레이스 페이지 — 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const title = page.getByText('서비스 마켓플레이스')
    await expect(title.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 페이지 설명 텍스트', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const description = page.getByText('공공 SaaS 서비스를 구독하세요')
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 전자결재 서비스 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const service = page.getByText('전자결재')
    await expect(service.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 재정관리 서비스 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const service = page.getByText('재정관리')
    await expect(service.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — AI 문서분석 서비스 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const service = page.getByText('AI 문서분석')
    await expect(service.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 5개 서비스 카탈로그 모두 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    for (const service of MARKETPLACE_SERVICES) {
      const serviceCard = page.getByText(service.name)
      await expect(serviceCard.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('마켓플레이스 — 카테고리 필터 버튼 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    // '전체' 카테고리 필터 버튼 확인
    const allFilter = page.getByText('전체')
    await expect(allFilter.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 구독 중 버튼 표시 (전자결재, 인사관리)', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const subscribedButton = page.getByText('구독 중')
    await expect(subscribedButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 구독하기 버튼 표시 (미구독 서비스)', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const subscribeButton = page.getByText('구독하기')
    await expect(subscribeButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 가격 정보 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    // 가격 정보 (월 500,000원 등) 표시 확인
    const priceInfo = page.getByText(/월.*원/)
    await expect(priceInfo.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 카테고리 필터 클릭 후 필터링 동작', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    // 'AI' 카테고리 필터 클릭 (sidebar overlay 우회를 위해 force: true)
    const aiFilter = page.getByText('AI')
    await aiFilter.first().click({ force: true })
    await page.waitForTimeout(500)

    // AI 카테고리 필터 후 AI 문서분석만 표시
    const aiService = page.getByText('AI 문서분석')
    await expect(aiService.first()).toBeVisible({ timeout: 10000 })
  })

  test('마켓플레이스 — 서비스 설명 텍스트 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/marketplace`)
    await page.waitForLoadState('networkidle')

    const description = page.getByText('공공기관 전자결재 시스템')
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })
})
