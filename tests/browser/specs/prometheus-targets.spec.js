// Prometheus 타겟 및 메트릭 테스트
// 대상: http://172.18.120.97:30090/
// 검증: UI 접근, 타겟 상태, 메트릭 쿼리

const { test, expect } = require('@playwright/test');

const PROMETHEUS_URL = 'http://172.18.120.97:30090';

test.describe('Prometheus 모니터링 테스트', () => {

  test('01. Prometheus 헬스체크 — 서비스 정상 응답', async ({ request }) => {
    const res = await request.get(`${PROMETHEUS_URL}/-/healthy`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('Healthy');
  });

  test('02. Prometheus Ready 확인', async ({ request }) => {
    const res = await request.get(`${PROMETHEUS_URL}/-/ready`);
    expect(res.status()).toBe(200);
  });

  test('03. Prometheus UI — 타겟 페이지 접근', async ({ page }) => {
    await page.goto(`${PROMETHEUS_URL}/targets`, { timeout: 30000 });
    // SPA가 렌더링될 때까지 대기
    await page.waitForTimeout(5000);

    const pageTitle = await page.title();
    console.log('Prometheus targets page title:', pageTitle);

    await page.screenshot({ path: 'reports/artifacts/03-prometheus-targets.png' });

    // Prometheus SPA — 타이틀로 페이지 정상 로드 확인
    expect(pageTitle).toContain('Prometheus');
  });

  test('04. Prometheus API — 타겟 상태 확인 (UP 비율)', async ({ request }) => {
    const res = await request.get(`${PROMETHEUS_URL}/api/v1/targets`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');

    const activeTargets = data.data.activeTargets;
    const upTargets = activeTargets.filter((t) => t.health === 'up');
    const downTargets = activeTargets.filter((t) => t.health === 'down');

    console.log(`타겟 현황: 전체 ${activeTargets.length}개, UP ${upTargets.length}개, DOWN ${downTargets.length}개`);
    if (downTargets.length > 0) {
      console.log('DOWN 타겟:', downTargets.map((t) => t.labels.job || t.scrapeUrl).join(', '));
    }

    // UP 타겟이 전체의 80% 이상이어야 함
    const upRatio = upTargets.length / activeTargets.length;
    expect(upRatio).toBeGreaterThanOrEqual(0.8);
    expect(upTargets.length).toBeGreaterThanOrEqual(10);
  });

  test('05. Prometheus 메트릭 — kube_pod_info 존재 확인', async ({ request }) => {
    const res = await request.get(
      `${PROMETHEUS_URL}/api/v1/query?query=count(kube_pod_info)`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');

    const result = data.data.result;
    expect(result.length).toBeGreaterThan(0);
    const podCount = parseInt(result[0].value[1], 10);
    console.log(`kube_pod_info 파드 수: ${podCount}`);
    expect(podCount).toBeGreaterThan(0);
  });

  test('06. Prometheus 메트릭 — node_memory_MemAvailable 존재 확인', async ({ request }) => {
    const res = await request.get(
      `${PROMETHEUS_URL}/api/v1/query?query=node_memory_MemAvailable_bytes`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.data.result.length).toBeGreaterThan(0);

    const memAvailBytes = parseFloat(data.data.result[0].value[1]);
    const memAvailGB = (memAvailBytes / 1024 / 1024 / 1024).toFixed(2);
    console.log(`메모리 여유: ${memAvailGB} GB`);
    expect(memAvailBytes).toBeGreaterThan(0);
  });

  test('07. Prometheus 메트릭 — CPU 사용률 쿼리', async ({ request }) => {
    const res = await request.get(
      `${PROMETHEUS_URL}/api/v1/query?query=100-(avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))*100)`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.data.result.length).toBeGreaterThan(0);

    const cpuUsage = parseFloat(data.data.result[0].value[1]).toFixed(2);
    console.log(`CPU 사용률: ${cpuUsage}%`);
    expect(parseFloat(cpuUsage)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(cpuUsage)).toBeLessThanOrEqual(100);
  });

  test('08. Prometheus 메트릭 — 디스크 여유공간 확인', async ({ request }) => {
    const res = await request.get(
      `${PROMETHEUS_URL}/api/v1/query?query=(node_filesystem_avail_bytes{mountpoint="/"}/node_filesystem_size_bytes{mountpoint="/"})*100`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');

    if (data.data.result.length > 0) {
      const diskFreePercent = parseFloat(data.data.result[0].value[1]).toFixed(2);
      console.log(`루트 디스크 여유: ${diskFreePercent}%`);
      // 디스크 여유 5% 이상 (CSAP 기준)
      expect(parseFloat(diskFreePercent)).toBeGreaterThan(5);
    }
  });

  test('09. Prometheus 알림 — Firing 알림 확인', async ({ request }) => {
    // k3s 환경에서 내장 컴포넌트로 인해 발생하는 알려진 오탐 알림 목록
    const KNOWN_K3S_FALSE_ALERTS = new Set([
      'KubeControllerManagerDown',
      'KubeSchedulerDown',
      'KubeProxyDown',
      'AlertmanagerClusterCrashlooping',
    ]);

    const res = await request.get(`${PROMETHEUS_URL}/api/v1/alerts`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');

    const alerts = data.data.alerts;
    const firingAlerts = alerts.filter(
      (a) => a.state === 'firing' && a.labels.severity !== 'none',
    );

    // 알려진 k3s 오탐 제외
    const realAlerts = firingAlerts.filter(
      (a) => !KNOWN_K3S_FALSE_ALERTS.has(a.labels.alertname),
    );

    console.log(`활성 알림: ${alerts.length}개, Firing (none 제외): ${firingAlerts.length}개`);
    console.log(`k3s 오탐 제외 후 실제 알림: ${realAlerts.length}개`);
    if (firingAlerts.length > 0) {
      firingAlerts.forEach((a) => {
        const isKnown = KNOWN_K3S_FALSE_ALERTS.has(a.labels.alertname);
        console.log(`  - ${a.labels.alertname} (${a.labels.severity})${isKnown ? ' [k3s 오탐]' : ''}`);
      });
    }

    // k3s 오탐을 제외한 critical 알림 없음
    const criticalRealAlerts = realAlerts.filter((a) => a.labels.severity === 'critical');
    if (criticalRealAlerts.length > 0) {
      console.warn('⚠️  실제 Critical 알림 발견:', criticalRealAlerts.map((a) => a.labels.alertname));
    }
    expect(criticalRealAlerts.length).toBe(0);
  });

});
