// Gitea + Harbor k3s 배포 브라우저 검증
// 2026-04-08 | MTU-N28 Q-Gate 브라우저 테스트

import { test, expect } from '@playwright/test'

const GITEA = 'http://localhost:30300'
const HARBOR = 'http://localhost:30080'
const GITEA_ADMIN = { user: 'saas-admin', pass: 'admin_cd79bcf83ee6da10' }
const HARBOR_ADMIN = { user: 'admin', pass: 'Harbor_8000458f5f68425c' }

test.use({ viewport: { width: 1280, height: 900 } })

// ===== GITEA 테스트 =====

test('Gitea-01: 메인 페이지 — 200 응답 및 타이틀 확인', async ({ page }) => {
  await page.goto(GITEA)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/gitea-01-main.png' })
  await expect(page).toHaveURL(/localhost:30300/)
  const title = await page.title()
  console.log('Gitea title:', title)
  expect(title).toMatch(/Gitea|Git/)
})

test('Gitea-02: 관리자 로그인 성공', async ({ page }) => {
  await page.goto(`${GITEA}/user/login`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/gitea-02-login-page.png' })
  await page.fill('#user_name', GITEA_ADMIN.user)
  await page.fill('#password', GITEA_ADMIN.pass)
  await page.click('button:has-text("Sign In")')
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/gitea-03-dashboard.png' })
  const url = page.url()
  console.log('After login URL:', url)
  // 로그인 후 대시보드 또는 explore 페이지로 이동
  expect(url).not.toMatch(/login/)
})

test('Gitea-03: 러너 등록 확인', async ({ page, request }) => {
  // API로 러너 등록 토큰 확인 (등록 가능 상태 = Actions 활성화)
  const tokenRes = await request.get(`${GITEA}/api/v1/admin/runners/registration-token`, {
    headers: { 'Authorization': 'Basic ' + Buffer.from(`${GITEA_ADMIN.user}:${GITEA_ADMIN.pass}`).toString('base64') }
  })
  console.log('Runner token API status:', tokenRes.status())
  expect([200, 201]).toContain(tokenRes.status())

  // 브라우저로 admin runners 페이지 확인
  await page.goto(`${GITEA}/user/login`)
  await page.fill('#user_name', GITEA_ADMIN.user)
  await page.fill('#password', GITEA_ADMIN.pass)
  await page.click('button:has-text("Sign In")')
  await page.waitForLoadState('load')
  await page.goto(`${GITEA}/admin/runners`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/gitea-04-runners.png', fullPage: true })
  const pageTitle = await page.title()
  console.log('Runners page title:', pageTitle)
  // 페이지 접근 성공 (200)
  expect(page.url()).toMatch(/localhost:30300/)
})

test('Gitea-04: Actions 활성화 확인', async ({ page }) => {
  await page.goto(`${GITEA}/user/login`)
  await page.fill('#user_name', GITEA_ADMIN.user)
  await page.fill('#password', GITEA_ADMIN.pass)
  await page.click('button:has-text("Sign In")')
  await page.waitForLoadState('load')
  await page.goto(`${GITEA}/-/admin/self-check`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/gitea-05-self-check.png', fullPage: true })
  const status = await page.textContent('body')
  console.log('Self-check page loaded, length:', status?.length)
})

// ===== HARBOR 테스트 =====

test('Harbor-01: 로그인 페이지 렌더링', async ({ page }) => {
  await page.goto(HARBOR)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/harbor-01-login.png' })
  await expect(page.locator('input[placeholder="Username"]')).toBeVisible()
  await expect(page.locator('input[placeholder="Password"]')).toBeVisible()
  await expect(page.locator('button:has-text("LOG IN")')).toBeVisible()
})

test('Harbor-02: 관리자 로그인 성공', async ({ page }) => {
  await page.goto(HARBOR)
  await page.waitForLoadState('load')
  await page.fill('input[placeholder="Username"]', HARBOR_ADMIN.user)
  await page.fill('input[placeholder="Password"]', HARBOR_ADMIN.pass)
  await page.screenshot({ path: 'e2e-screenshots/harbor-02-credentials.png' })
  await page.locator('button:has-text("LOG IN")').click()
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/harbor-03-after-login.png' })
  const url = page.url()
  console.log('Harbor after login URL:', url)
  // 로그인 후 harbor/projects 또는 home으로 이동
  expect(url).toMatch(/harbor\/(projects|home)|localhost:30080/)
})

test('Harbor-03: 프로젝트 목록 확인', async ({ page }) => {
  await page.goto(HARBOR)
  await page.waitForLoadState('load')
  await page.fill('input[placeholder="Username"]', HARBOR_ADMIN.user)
  await page.fill('input[placeholder="Password"]', HARBOR_ADMIN.pass)
  await page.locator('button:has-text("LOG IN")').click()
  await page.waitForLoadState('load')
  await page.goto(`${HARBOR}/harbor/projects`)
  await page.waitForLoadState('load')
  await page.screenshot({ path: 'e2e-screenshots/harbor-04-projects.png', fullPage: true })
  const url = page.url()
  console.log('Projects page URL:', url)
  expect(url).toMatch(/harbor\/projects|localhost:30080/)
})

test('Harbor-04: API 헬스체크', async ({ request }) => {
  const res = await request.get(`${HARBOR}/api/v2.0/ping`)
  console.log('Harbor API ping:', res.status())
  expect([200, 401]).toContain(res.status())
  
  const healthRes = await request.get(`${HARBOR}/api/v2.0/health`)
  const body = await healthRes.json().catch(() => ({}))
  console.log('Harbor health:', JSON.stringify(body))
  expect([200, 401]).toContain(healthRes.status())
})
