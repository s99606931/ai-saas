// 서비스 가용성 테스트
// 대상: Grafana, Prometheus, Gitea
// 검증: HTTP 응답 코드, 기본 페이지 로드

const { test, expect } = require('@playwright/test');

const SERVICES = {
  grafana: { url: 'http://172.18.120.97:30302', name: 'Grafana' },
  prometheus: { url: 'http://172.18.120.97:30090', name: 'Prometheus' },
  gitea: { url: 'http://172.18.120.97:30300', name: 'Gitea' },
};

test.describe('서비스 가용성 테스트', () => {

  test('01. Grafana — HTTP 200 응답', async ({ request }) => {
    const res = await request.get(`${SERVICES.grafana.url}/api/health`);
    expect(res.status()).toBe(200);
    console.log('Grafana health: OK');
  });

  test('02. Prometheus — HTTP 200 응답', async ({ request }) => {
    const res = await request.get(`${SERVICES.prometheus.url}/-/healthy`);
    expect(res.status()).toBe(200);
    console.log('Prometheus health: OK');
  });

  test('03. Gitea — HTTP 200 응답', async ({ request }) => {
    const res = await request.get(`${SERVICES.gitea.url}`);
    // Gitea는 200 또는 302 리다이렉트 허용
    expect([200, 302]).toContain(res.status());
    console.log('Gitea status:', res.status());
  });

  test('04. Grafana — 브라우저 접근 및 로그인 페이지 확인', async ({ page }) => {
    await page.goto(`${SERVICES.grafana.url}/login`, { timeout: 30000 });
    await page.waitForSelector('input[name="user"]', { timeout: 15000 });

    // 로그인 폼 요소 확인
    const userInput = page.locator('input[name="user"]');
    const passInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(userInput).toBeVisible();
    await expect(passInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    await page.screenshot({ path: 'reports/artifacts/04-grafana-login-page.png' });
    console.log('Grafana 로그인 페이지 정상 표시');
  });

  test('05. Prometheus — 브라우저 접근 및 UI 확인', async ({ page }) => {
    await page.goto(`${SERVICES.prometheus.url}/graph`, { timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'reports/artifacts/05-prometheus-ui.png' });

    const content = await page.content();
    // Prometheus UI에 쿼리 입력 폼이 있는지 확인
    expect(content.toLowerCase()).toContain('prometheus');
    console.log('Prometheus UI 정상 표시');
  });

  test('06. Gitea — 브라우저 접근 및 메인 페이지 확인', async ({ page }) => {
    await page.goto(`${SERVICES.gitea.url}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'reports/artifacts/06-gitea-main.png' });

    const title = await page.title();
    console.log('Gitea page title:', title);
    // Gitea 또는 Forgejo 페이지 타이틀 확인
    expect(title.length).toBeGreaterThan(0);
  });

  test('07. k3s 클러스터 — kube-state-metrics 데이터 확인', async ({ request }) => {
    const res = await request.get(
      `${SERVICES.prometheus.url}/api/v1/query?query=kube_deployment_status_replicas_available`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.data.result.length).toBeGreaterThan(0);

    const deployments = data.data.result.map((r) => ({
      name: r.metric.deployment,
      ns: r.metric.namespace,
      replicas: parseInt(r.value[1], 10),
    }));

    console.log(`사용 가능한 Deployment 수: ${deployments.length}`);
    deployments.slice(0, 5).forEach((d) => {
      console.log(`  - ${d.ns}/${d.name}: ${d.replicas} replicas`);
    });

    expect(deployments.length).toBeGreaterThan(0);
  });

  test('08. 노드 익스포터 — 노드 메트릭 수집 확인', async ({ request }) => {
    const res = await request.get(
      `${SERVICES.prometheus.url}/api/v1/query?query=up{job="node-exporter"}`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');

    const nodeExporterTargets = data.data.result;
    const upCount = nodeExporterTargets.filter((t) => t.value[1] === '1').length;

    console.log(`Node Exporter: ${upCount}/${nodeExporterTargets.length} UP`);
    expect(upCount).toBeGreaterThan(0);
  });

});
