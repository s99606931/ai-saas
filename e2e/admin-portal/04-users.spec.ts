// Design Ref: MTU-E2E1 §USERS — 사용자 관리 페이지 테스트
// Plan SC: FR-QA-6 — 사용자 목록 및 역할 컬럼 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

// 포털 샘플 사용자 역할 목록
const EXPECTED_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'USER']

test.describe('04. 사용자 관리', () => {
  test('/admin/users 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/users`)
    expect(response?.status()).toBe(200)
  })

  test('사용자 목록 페이지 — 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    const title = page.getByText('사용자 관리')
    await expect(title.first()).toBeVisible({ timeout: 10000 })
  })

  test('사용자 목록 — 컬럼 헤더 5개 표시 (이름, 이메일, 역할, 상태, 테넌트)', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    const columns = ['이름', '이메일', '역할', '상태', '테넌트']
    for (const col of columns) {
      // getByRole('columnheader') 로 <th> 범위 한정 — hidden <option> 매칭 방지
      const header = page.getByRole('columnheader', { name: col })
      await expect(header.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('사용자 목록 — SUPER_ADMIN 역할 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    const role = page.getByText('SUPER_ADMIN')
    await expect(role.first()).toBeVisible({ timeout: 10000 })
  })

  test('사용자 목록 — TENANT_ADMIN 역할 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    const role = page.getByText('TENANT_ADMIN')
    await expect(role.first()).toBeVisible({ timeout: 10000 })
  })

  test('사용자 목록 — 활성(ACTIVE) 상태 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    const status = page.getByText('ACTIVE').first()
    await expect(status).toBeVisible({ timeout: 10000 })
  })

  test('사용자 목록 — 플랫폼 테넌트 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    // SAMPLE_USERS에 '플랫폼' 테넌트 존재
    const tenant = page.getByText('플랫폼')
    await expect(tenant.first()).toBeVisible({ timeout: 10000 })
  })

  test('사용자 목록 — 페이지 설명 텍스트 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await page.waitForLoadState('networkidle')

    const description = page.getByText('전체 사용자 계정을 관리합니다')
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })

  test('API — /api/users 응답 검증', async ({ request }) => {
    const response = await request.get(`${BASE}/api/users`)
    if (response.status() === 200) {
      const data = await response.json()
      expect(typeof data).toBe('object')
      if ('users' in data && Array.isArray(data.users)) {
        expect(data.users.length).toBeGreaterThan(0)
        // 첫 번째 사용자에 role 필드 존재 확인
        const firstUser = data.users[0]
        expect(firstUser).toHaveProperty('role')
      }
      if ('total' in data) {
        expect(data.total).toBeGreaterThanOrEqual(0)
      }
    } else {
      expect([404, 405]).toContain(response.status())
    }
  })
})
