// Design Ref: MTU-E2E1 §COMPLIANCE — CSAP/N2SF 준수 현황 테스트
// Plan SC: FR-QA-7 — CSAP 79항목 + N2SF 6영역 준수 현황 표시 검증

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:4000'

// CSAP 12개 분야 (D-01 ~ D-12)
const CSAP_DOMAINS = [
  { id: 'D-01', name: '정보보호 정책' },
  { id: 'D-02', name: '정보보호 조직' },
  { id: 'D-03', name: '자산 관리' },
  { id: 'D-04', name: '인적 보안' },
  { id: 'D-05', name: '물리적 보안' },
  { id: 'D-06', name: '침해사고 관리' },
  { id: 'D-07', name: '서비스 연속성' },
  { id: 'D-08', name: '접근 통제' },
  { id: 'D-09', name: '암호화' },
  { id: 'D-10', name: '네트워크 보안' },
  { id: 'D-11', name: '시스템 보안' },
  { id: 'D-12', name: '시스템 개발 보안' },
]

// N2SF 6개 영역
const N2SF_DOMAINS = [
  { id: 'N-01', name: '네트워크 분리' },
  { id: 'N-02', name: '데이터 등급 분류' },
  { id: 'N-03', name: '접근 통제' },
  { id: 'N-04', name: '인증 강화' },
  { id: 'N-05', name: 'AI 연동 보안' },
  { id: 'N-06', name: '감사 추적' },
]

test.describe('05. CSAP/N2SF 준수 현황', () => {
  test('/admin/compliance 페이지 — HTTP 200 정상 응답', async ({ page }) => {
    const response = await page.goto(`${BASE}/admin/compliance`)
    expect(response?.status()).toBe(200)
  })

  test('준수 현황 페이지 — 제목 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/compliance`)
    await page.waitForLoadState('networkidle')

    const title = page.getByText('규제 준수 현황')
    await expect(title.first()).toBeVisible({ timeout: 10000 })
  })

  test('CSAP 79항목 섹션 헤딩 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/compliance`)
    await page.waitForLoadState('networkidle')

    const csapHeading = page.getByText(/CSAP.*79항목/i)
    await expect(csapHeading.first()).toBeVisible({ timeout: 10000 })
  })

  test('N2SF 6영역 섹션 헤딩 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin/compliance`)
    await page.waitForLoadState('networkidle')

    const n2sfHeading = page.getByText(/N2SF.*6영역/i)
    await expect(n2sfHeading.first()).toBeVisible({ timeout: 10000 })
  })

  // CSAP 핵심 분야 개별 검증
  for (const domain of [CSAP_DOMAINS[0], CSAP_DOMAINS[7], CSAP_DOMAINS[8], CSAP_DOMAINS[11]]) {
    test(`CSAP 분야 표시 — ${domain.id} ${domain.name}`, async ({ page }) => {
      await page.goto(`${BASE}/admin/compliance`)
      await page.waitForLoadState('networkidle')

      const domainId = page.getByText(domain.id)
      await expect(domainId.first()).toBeVisible({ timeout: 10000 })

      const domainName = page.getByText(domain.name)
      await expect(domainName.first()).toBeVisible({ timeout: 10000 })
    })
  }

  test('CSAP 전체 12개 분야 ID 표시 확인', async ({ page }) => {
    await page.goto(`${BASE}/admin/compliance`)
    await page.waitForLoadState('networkidle')

    // D-01 ~ D-12 모든 ID 표시 확인
    for (const domain of CSAP_DOMAINS) {
      const domainElement = page.getByText(domain.id)
      await expect(domainElement.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('N2SF 전체 6개 영역 ID 표시 확인', async ({ page }) => {
    await page.goto(`${BASE}/admin/compliance`)
    await page.waitForLoadState('networkidle')

    // N-01 ~ N-06 모든 ID 표시 확인
    for (const domain of N2SF_DOMAINS) {
      const domainElement = page.getByText(domain.id)
      await expect(domainElement.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('준수율 100% 표시 확인', async ({ page }) => {
    await page.goto(`${BASE}/admin/compliance`)
    await page.waitForLoadState('networkidle')

    // 100% 텍스트 최소 1개 이상 표시
    const hundredPercent = page.getByText('100%')
    await expect(hundredPercent.first()).toBeVisible({ timeout: 10000 })
  })

  test('API — /api/compliance/csap 응답 검증', async ({ request }) => {
    const response = await request.get(`${BASE}/api/compliance/csap`)
    if (response.status() === 200) {
      const data = await response.json()
      expect(typeof data).toBe('object')
    } else {
      // Static 포털 API 미구현 허용
      expect([404, 405]).toContain(response.status())
    }
  })
})
