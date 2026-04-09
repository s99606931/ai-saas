// Grafana 모니터링 브라우저 테스트
// 대상: http://172.18.120.97:30302/
// 인증: 서비스 계정 토큰 (API 잠금 방지)

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const GRAFANA_URL = 'http://172.18.120.97:30302';

// 서비스 계정 토큰 로드 (.env.test에서)
function getSaToken() {
  const envFile = path.join(__dirname, '../.env.test');
  if (!fs.existsSync(envFile)) {
    throw new Error('.env.test 파일이 없습니다. 서비스 계정 토큰을 생성하세요.');
  }
  const content = fs.readFileSync(envFile, 'utf8');
  const match = content.match(/GRAFANA_SA_TOKEN=(.+)/);
  if (!match) throw new Error('GRAFANA_SA_TOKEN이 .env.test에 없습니다.');
  return match[1].trim();
}

function tokenHeader() {
  return { Authorization: `Bearer ${getSaToken()}` };
}

test.describe('Grafana 모니터링 테스트', () => {

  test('01. Grafana 헬스체크 — 서비스 정상 응답', async ({ request }) => {
    const res = await request.get(`${GRAFANA_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.database).toBe('ok');
    console.log('Grafana 버전:', body.version);
  });

  test('02. Grafana 서비스 계정 — 토큰 인증 성공', async ({ request }) => {
    const res = await request.get(`${GRAFANA_URL}/api/org`, {
      headers: tokenHeader(),
    });
    expect(res.status()).toBe(200);
    const org = await res.json();
    console.log('Grafana 조직:', org.name, '(ID:', org.id, ')');
    expect(org.id).toBeGreaterThan(0);
  });

  test('03. 대시보드 목록 — 한국어 대시보드 존재 확인', async ({ request }) => {
    const res = await request.get(`${GRAFANA_URL}/api/search?type=dash-db`, {
      headers: tokenHeader(),
    });
    expect(res.status()).toBe(200);
    const dashboards = await res.json();
    const titles = dashboards.map((d) => d.title);

    console.log(`전체 대시보드 수: ${titles.length}`);

    // 한국어 대시보드 존재 확인
    const mainDash = titles.includes('k3s 공공 SaaS — 메인 모니터링');
    const workloadDash = titles.includes('k3s 공공 SaaS — 파드 & 워크로드 현황');
    console.log('메인 대시보드:', mainDash ? '✓ 존재' : '✗ 없음');
    console.log('워크로드 대시보드:', workloadDash ? '✓ 존재' : '✗ 없음');

    expect(mainDash).toBeTruthy();
    expect(workloadDash).toBeTruthy();
  });

  test('04. 메인 모니터링 대시보드 — 브라우저 접근 및 타이틀 확인', async ({ page }) => {
    // 서비스 계정 토큰을 Bearer로 쿠키에 주입 (Grafana는 Authorization 헤더 지원)
    await page.setExtraHTTPHeaders(tokenHeader());

    await page.goto(`${GRAFANA_URL}/d/k3s-korean-main`, {
      timeout: 45000,
    });

    await page.waitForTimeout(8000);

    const pageTitle = await page.title();
    console.log('대시보드 타이틀:', pageTitle);

    await page.screenshot({ path: 'reports/artifacts/04-main-dashboard.png' });

    // 대시보드 타이틀 확인
    expect(pageTitle).toContain('k3s 공공 SaaS — 메인 모니터링');
  });

  test('05. 파드 워크로드 대시보드 — 브라우저 접근 및 타이틀 확인', async ({ page }) => {
    await page.setExtraHTTPHeaders(tokenHeader());

    await page.goto(`${GRAFANA_URL}/d/k3s-korean-workload`, {
      timeout: 45000,
    });

    await page.waitForTimeout(8000);

    const pageTitle = await page.title();
    console.log('워크로드 대시보드 타이틀:', pageTitle);

    await page.screenshot({ path: 'reports/artifacts/05-workload-dashboard.png' });

    expect(pageTitle).toContain('k3s 공공 SaaS — 파드 & 워크로드 현황');
  });

  test('06. Grafana 데이터소스 — 4개 데이터소스 존재 확인', async ({ request }) => {
    const res = await request.get(`${GRAFANA_URL}/api/datasources`, {
      headers: tokenHeader(),
    });
    expect(res.status()).toBe(200);
    const datasources = await res.json();
    const dsNames = datasources.map((d) => d.name);
    console.log('데이터소스 목록:', dsNames.join(', '));

    expect(dsNames).toContain('Prometheus');
    expect(dsNames).toContain('Loki');
    expect(dsNames).toContain('Tempo');
    expect(dsNames).toContain('Alertmanager');
  });

  test('07. Grafana 데이터소스 — Prometheus health 확인', async ({ request }) => {
    const dsRes = await request.get(`${GRAFANA_URL}/api/datasources`, {
      headers: tokenHeader(),
    });
    const datasources = await dsRes.json();
    const prometheus = datasources.find((d) => d.type === 'prometheus');
    expect(prometheus).toBeTruthy();

    const healthRes = await request.get(
      `${GRAFANA_URL}/api/datasources/${prometheus.id}/health`,
      { headers: tokenHeader() },
    );
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    console.log('Prometheus health:', health.status, '-', health.message);
    expect(health.status).toBe('OK');
  });

  test('08. Grafana 알림 — Alertmanager 데이터소스 확인', async ({ request }) => {
    const res = await request.get(`${GRAFANA_URL}/api/datasources`, {
      headers: tokenHeader(),
    });
    const datasources = await res.json();
    const alertmanager = datasources.find((d) => d.type === 'alertmanager');
    expect(alertmanager).toBeTruthy();
    console.log('Alertmanager URL:', alertmanager.url);
    expect(alertmanager.url).toContain('alertmanager');
  });

});
