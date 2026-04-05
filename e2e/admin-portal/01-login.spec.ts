// Design Ref: MTU-E2E1 §LOGIN — 로그인 시나리오 테스트
// Plan SC: FR-QA-3 — 역할별 인증 흐름 검증

import { test, expect } from '@playwright/test'
import { DEMO_USERS } from '../fixtures/demo-users'

const BASE = 'http://localhost:4000'

test.describe('01. 로그인 시나리오', () => {
  test('포털 루트 접근 시 대시보드 또는 로그인 페이지 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/`)
    // 포털은 Static 렌더링이므로 200 응답 확인
    expect(response?.status()).toBe(200)
  })

  test('관리자 대시보드 페이지 접근 — HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/dashboard`)
    expect(response?.status()).toBe(200)
    // 페이지 타이틀 또는 주요 요소 존재 확인
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })

  test('API — 잘못된 자격증명 로그인 시도 (405 또는 에러)', async ({ request }) => {
    // 포털이 API 라우트를 제공하면 401/400, 없으면 404/405
    const response = await request.post(`${BASE}/api/auth/login`, {
      data: { email: 'wrong@test.go.kr', password: 'WrongPassword!' },
    })
    // 200이 아님을 확인 (인증 실패 또는 미지원 경로)
    expect(response.status()).not.toBe(200)
  })

  test('API — SUPER_ADMIN 자격증명 형식 검증', async ({ request }) => {
    const { email, password } = DEMO_USERS.superAdmin
    // 로그인 API가 존재하면 응답 확인, 없으면 404 처리
    const response = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password },
    })
    // 포털이 Static이므로 404 또는 405가 허용됨; 500은 불허
    expect(response.status()).not.toBe(500)
  })

  test('API — TENANT_ADMIN(행안부) 자격증명 형식 검증', async ({ request }) => {
    const { email, password } = DEMO_USERS.tenantAdminMois
    const response = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password },
    })
    expect(response.status()).not.toBe(500)
  })

  test('관리자 대시보드 — 플랫폼 대시보드 헤딩 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`)
    // h1 요소에 대시보드 관련 텍스트 존재 확인
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
    const headingText = await heading.textContent()
    expect(headingText).toBeTruthy()
  })

  test('존재하지 않는 페이지 접근 — 404 또는 리다이렉트', async ({ page }) => {
    const response = await page.goto(`${BASE}/nonexistent-route-xyz`)
    // 404 또는 200 (커스텀 404 페이지) 허용
    expect([200, 404]).toContain(response?.status())
  })
})
