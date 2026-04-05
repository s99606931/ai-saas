// Design Ref: MTU-E2E1 §TENANT-DASHBOARD — 테넌트 대시보드 테스트
// Plan SC: FR-QA-8 — 테넌트 포털 대시보드 기능 검증

import { test, expect } from '@playwright/test'
import { DEMO_USERS } from '../fixtures/demo-users'

const BASE = 'http://localhost:4000'

test.describe('01. 테넌트 대시보드', () => {
  test('/tenant/dashboard 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/tenant/dashboard`)
    expect(response?.status()).toBe(200)
  })

  test('테넌트 대시보드 — 페이지 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    const title = page.getByText('대시보드')
    await expect(title.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 대시보드 — 구독 서비스 현황 설명 텍스트', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    const description = page.getByText('구독 서비스 현황을 확인하세요')
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 대시보드 — 활성 서비스 통계 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    const activeServices = page.getByText('활성 서비스')
    await expect(activeServices.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 대시보드 — 사용자 수 통계 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    const userCount = page.getByText('사용자 수')
    await expect(userCount.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 대시보드 — AI 사용량 통계 카드 표시', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    const aiUsage = page.getByText('AI 사용량')
    await expect(aiUsage.first()).toBeVisible({ timeout: 10000 })
  })

  test('테넌트 대시보드 — 통계 카드 3개 표시 (활성 서비스, 사용자 수, AI 사용량)', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    const cards = ['활성 서비스', '사용자 수', 'AI 사용량']
    for (const card of cards) {
      const element = page.getByText(card)
      await expect(element.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('테넌트 대시보드 — 숫자 값 표시 (3, 42)', async ({ page }) => {
    await page.goto(`${BASE}/tenant/dashboard`)
    await page.waitForLoadState('networkidle')

    // 활성 서비스 3, 사용자 수 42 확인
    const serviceCount = page.getByText('3')
    await expect(serviceCount.first()).toBeVisible({ timeout: 10000 })

    const userCount = page.getByText('42')
    await expect(userCount.first()).toBeVisible({ timeout: 10000 })
  })

  test('TENANT_ADMIN 계정 정보 형식 검증', async () => {
    const { email, role } = DEMO_USERS.tenantAdminMois
    // 이메일 형식 검증 (단순 패턴 확인)
    expect(email).toMatch(/^[^@]+@[^@]+\.[^@]+$/)
    expect(role).toBe('TENANT_ADMIN')
  })
})
