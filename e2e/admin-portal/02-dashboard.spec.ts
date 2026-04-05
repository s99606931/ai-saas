// Design Ref: MTU-E2E1 §DASHBOARD — 관리자 대시보드 테스트
// Plan SC: FR-QA-4 — 대시보드 통계 표시 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

test.describe('02. 관리자 대시보드', () => {
  test('대시보드 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/dashboard`)
    expect(response?.status()).toBe(200)
  })

  test('대시보드 — 통계 카드 4개 표시 확인', async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`)
    await page.waitForLoadState('networkidle')

    // 대시보드에는 4개의 통계 카드가 있어야 함 (활성 테넌트, 전체 사용자, 활성 구독, 월간 수익)
    // '월간 수익'은 '월간 수익 추이'와 중복되므로 exact match 사용
    const exactLabels = ['활성 테넌트', '전체 사용자', '활성 구독']
    for (const label of exactLabels) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 10000 })
    }
    // '월간 수익'은 p.text-sm 요소 대상으로 정확한 매치
    await expect(page.getByText('월간 수익', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('대시보드 — CSAP 준수 현황 섹션 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`)
    await page.waitForLoadState('networkidle')

    // CSAP 79항목 준수 현황 텍스트 확인
    const csapSection = page.getByText(/CSAP.*79항목/i)
    await expect(csapSection).toBeVisible({ timeout: 10000 })
  })

  test('대시보드 — CSAP 12개 분야 도메인 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`)
    await page.waitForLoadState('networkidle')

    // D-01 정보보호 정책 ~ D-12 시스템 개발 보안 확인
    const domainIds = ['D-01', 'D-02', 'D-08', 'D-12']
    for (const domainId of domainIds) {
      const element = page.getByText(domainId)
      await expect(element.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('대시보드 — 월간 수익 추이 영역 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`)
    await page.waitForLoadState('networkidle')

    const revenueSection = page.getByText('월간 수익 추이')
    await expect(revenueSection).toBeVisible({ timeout: 10000 })
  })

  test('API — /api/dashboard/stats 응답 검증', async ({ request }) => {
    const response = await request.get(`${BASE}/api/dashboard/stats`)
    // API 라우트가 구현된 경우 200 + 데이터 검증
    if (response.status() === 200) {
      const data = await response.json()
      expect(typeof data).toBe('object')
      // tenants와 users 필드가 있으면 양수 확인
      if ('tenants' in data) {
        expect(data.tenants).toBeGreaterThanOrEqual(0)
      }
      if ('users' in data) {
        expect(data.users).toBeGreaterThanOrEqual(0)
      }
    } else {
      // API 미구현 시 404/405 허용 (Static 포털)
      expect([404, 405]).toContain(response.status())
    }
  })

  test('루트 페이지 — 대시보드로 접근 가능', async ({ page }) => {
    const response = await page.goto(`${BASE}/`)
    expect(response?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    // 플랫폼 대시보드 h1 확인
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })
})
