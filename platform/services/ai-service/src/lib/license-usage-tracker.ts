// SaaS 라이선스 사용량 추적 -- FR-N302.1~FR-N302.6
// Design Ref: MTU-N302 DESIGN §1~§6
// Plan SC: SC-1 (추적정확도 99%+), SC-2 (초과탐지 1분), SC-3 (리포트 10초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 라이선스 타입 */
export type LicenseType = 'per_user' | 'per_feature' | 'per_api_call' | 'per_storage' | 'flat_rate';

/** 라이선스 정보 */
export interface LicenseInfo {
  readonly licenseId: string;
  readonly tenantId: string;
  readonly licenseType: LicenseType;
  readonly name: string;
  readonly limit: number;
  readonly unit: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly autoRenew: boolean;
  readonly status: 'active' | 'expired' | 'suspended';
}

/** 사용량 메트릭 */
export interface UsageMetric {
  readonly metricId: string;
  readonly licenseId: string;
  readonly tenantId: string;
  readonly currentUsage: number;
  readonly limit: number;
  readonly usageRate: number;
  readonly recordedAt: string;
}

/** 초과 알림 */
export interface LicenseAlert {
  readonly alertId: string;
  readonly tenantId: string;
  readonly licenseId: string;
  readonly alertType: 'approaching_limit' | 'exceeded' | 'expiring_soon' | 'expired';
  readonly message: string;
  readonly currentValue: number;
  readonly threshold: number;
  readonly createdAt: string;
}

/** 월별 사용 리포트 */
export interface MonthlyUsageReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly period: string; // YYYY-MM
  readonly licenses: Array<{
    licenseId: string;
    name: string;
    limit: number;
    peakUsage: number;
    avgUsage: number;
    complianceStatus: 'compliant' | 'warning' | 'violation';
  }>;
  readonly totalCost: number;
  readonly generatedAt: string;
}

/** 갱신 예측 */
export interface RenewalForecast {
  readonly licenseId: string;
  readonly name: string;
  readonly expiresAt: string;
  readonly daysRemaining: number;
  readonly usageTrend: 'increasing' | 'stable' | 'decreasing';
  readonly recommendedAction: 'renew' | 'upgrade' | 'downgrade' | 'cancel';
  readonly estimatedCost: number;
}

/** 감사 로그 */
export interface LicenseAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: LicenseAuditEntry[] = [];

function recordAudit(entry: Omit<LicenseAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getLicenseAuditLog(tenantId: string): readonly LicenseAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 라이선스 CRUD ────────────────────────────────────────────────────────────

const licenseStore: Map<string, LicenseInfo[]> = new Map();

/** 라이선스 등록 -- FR-N302.1 */
export function registerLicense(
  tenantId: string,
  licenseType: LicenseType,
  name: string,
  limit: number,
  unit: string,
  endDate: string,
  autoRenew: boolean = true,
): LicenseInfo {
  const license: LicenseInfo = {
    licenseId: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    licenseType,
    name,
    limit,
    unit,
    startDate: new Date().toISOString(),
    endDate,
    autoRenew,
    status: 'active',
  };

  const existing = licenseStore.get(tenantId) ?? [];
  existing.push(license);
  licenseStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'LICENSE_REGISTERED',
    target: license.licenseId,
    details: { licenseType, name, limit, unit },
  });

  return license;
}

/** 라이선스 목록 조회 */
export function getLicenses(tenantId: string): readonly LicenseInfo[] {
  return licenseStore.get(tenantId) ?? [];
}

// -- 사용량 메트릭 수집 ──────────────────────────────────────────────────────

const metricStore: Map<string, UsageMetric[]> = new Map();

/** 사용량 메트릭 기록 -- FR-N302.2 */
export function recordUsageMetric(
  tenantId: string,
  licenseId: string,
  currentUsage: number,
): UsageMetric {
  const licenses = getLicenses(tenantId);
  const license = licenses.find(l => l.licenseId === licenseId);
  const limit = license?.limit ?? 0;
  const usageRate = limit > 0 ? currentUsage / limit : 0;

  const metric: UsageMetric = {
    metricId: `metric-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    licenseId,
    tenantId,
    currentUsage,
    limit,
    usageRate,
    recordedAt: new Date().toISOString(),
  };

  const key = `${tenantId}:${licenseId}`;
  const existing = metricStore.get(key) ?? [];
  existing.push(metric);
  metricStore.set(key, existing);

  return metric;
}

// -- 초과 감지 ────────────────────────────────────────────────────────────────

const alertStore: LicenseAlert[] = [];

/** 라이선스 초과 감지 및 알림 -- FR-N302.3 */
export function checkLicenseExceedance(
  tenantId: string,
  licenseId: string,
  currentUsage: number,
): LicenseAlert | null {
  const licenses = getLicenses(tenantId);
  const license = licenses.find(l => l.licenseId === licenseId);
  if (!license) return null;

  const usageRate = currentUsage / license.limit;

  if (usageRate >= 1.0) {
    const alert: LicenseAlert = {
      alertId: `lalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      licenseId,
      alertType: 'exceeded',
      message: `라이선스 초과: ${license.name} - ${currentUsage}/${license.limit} ${license.unit}`,
      currentValue: currentUsage,
      threshold: license.limit,
      createdAt: new Date().toISOString(),
    };
    alertStore.push(alert);

    recordAudit({
      actor: 'system',
      tenantId,
      action: 'LICENSE_EXCEEDED',
      target: licenseId,
      details: { currentUsage, limit: license.limit, usageRate },
    });

    return alert;
  }

  if (usageRate >= 0.85) {
    const alert: LicenseAlert = {
      alertId: `lalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      licenseId,
      alertType: 'approaching_limit',
      message: `라이선스 경고: ${license.name} - ${(usageRate * 100).toFixed(0)}% 사용`,
      currentValue: currentUsage,
      threshold: license.limit,
      createdAt: new Date().toISOString(),
    };
    alertStore.push(alert);
    return alert;
  }

  return null;
}

/** 라이선스 만료 체크 */
export function checkLicenseExpiry(tenantId: string): LicenseAlert[] {
  const licenses = getLicenses(tenantId);
  const now = Date.now();
  const alerts: LicenseAlert[] = [];

  for (const license of licenses) {
    const endTime = new Date(license.endDate).getTime();
    const daysRemaining = Math.floor((endTime - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      alerts.push({
        alertId: `lalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        licenseId: license.licenseId,
        alertType: 'expired',
        message: `라이선스 만료: ${license.name}`,
        currentValue: 0,
        threshold: 0,
        createdAt: new Date().toISOString(),
      });
    } else if (daysRemaining <= 30) {
      alerts.push({
        alertId: `lalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        licenseId: license.licenseId,
        alertType: 'expiring_soon',
        message: `라이선스 만료 ${daysRemaining}일 전: ${license.name}`,
        currentValue: daysRemaining,
        threshold: 30,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

// -- 월별 리포트 ──────────────────────────────────────────────────────────────

/** 월별 사용 리포트 생성 -- FR-N302.4 */
export function generateMonthlyReport(
  tenantId: string,
  period: string,
): MonthlyUsageReport {
  const licenses = getLicenses(tenantId);
  const licenseReports: MonthlyUsageReport['licenses'] = [];

  for (const license of licenses) {
    const key = `${tenantId}:${license.licenseId}`;
    const metrics = metricStore.get(key) ?? [];

    const usages = metrics.map(m => m.currentUsage);
    const peakUsage = usages.length > 0 ? Math.max(...usages) : 0;
    const avgUsage = usages.length > 0 ? usages.reduce((s, u) => s + u, 0) / usages.length : 0;

    let complianceStatus: 'compliant' | 'warning' | 'violation' = 'compliant';
    if (peakUsage > license.limit) complianceStatus = 'violation';
    else if (peakUsage > license.limit * 0.85) complianceStatus = 'warning';

    licenseReports.push({
      licenseId: license.licenseId,
      name: license.name,
      limit: license.limit,
      peakUsage,
      avgUsage,
      complianceStatus,
    });
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'MONTHLY_REPORT_GENERATED',
    target: tenantId,
    details: { period, licensesReported: licenseReports.length },
  });

  return {
    reportId: `lic-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    period,
    licenses: licenseReports,
    totalCost: licenseReports.length * 1000000, // 시뮬레이션
    generatedAt: new Date().toISOString(),
  };
}

// -- 갱신 예측 ────────────────────────────────────────────────────────────────

/** 라이선스 갱신 예측 -- FR-N302.5 */
export function forecastRenewal(tenantId: string): RenewalForecast[] {
  const licenses = getLicenses(tenantId);
  const now = Date.now();
  const forecasts: RenewalForecast[] = [];

  for (const license of licenses) {
    const endTime = new Date(license.endDate).getTime();
    const daysRemaining = Math.max(0, Math.floor((endTime - now) / (1000 * 60 * 60 * 24)));

    const key = `${tenantId}:${license.licenseId}`;
    const metrics = metricStore.get(key) ?? [];

    let usageTrend: RenewalForecast['usageTrend'] = 'stable';
    if (metrics.length >= 2) {
      const firstMetric = metrics[0];
      const lastMetric = metrics[metrics.length - 1];
      if (firstMetric && lastMetric) {
        const delta = lastMetric.currentUsage - firstMetric.currentUsage;
        if (delta > firstMetric.currentUsage * 0.1) usageTrend = 'increasing';
        else if (delta < -firstMetric.currentUsage * 0.1) usageTrend = 'decreasing';
      }
    }

    let recommendedAction: RenewalForecast['recommendedAction'] = 'renew';
    if (usageTrend === 'increasing') recommendedAction = 'upgrade';
    else if (usageTrend === 'decreasing') recommendedAction = 'downgrade';

    forecasts.push({
      licenseId: license.licenseId,
      name: license.name,
      expiresAt: license.endDate,
      daysRemaining,
      usageTrend,
      recommendedAction,
      estimatedCost: license.limit * 100, // 시뮬레이션
    });
  }

  return forecasts;
}

/** SaaS 라이선스 사용량 추적 서비스 */
export class LicenseUsageTrackerService {
  constructor(private readonly tenantId: string) {}

  register(type: LicenseType, name: string, limit: number, unit: string, endDate: string): LicenseInfo {
    return registerLicense(this.tenantId, type, name, limit, unit, endDate);
  }

  getLicenses(): readonly LicenseInfo[] {
    return getLicenses(this.tenantId);
  }

  recordUsage(licenseId: string, usage: number): UsageMetric {
    return recordUsageMetric(this.tenantId, licenseId, usage);
  }

  checkExceedance(licenseId: string, usage: number): LicenseAlert | null {
    return checkLicenseExceedance(this.tenantId, licenseId, usage);
  }

  checkExpiry(): LicenseAlert[] {
    return checkLicenseExpiry(this.tenantId);
  }

  generateReport(period: string): MonthlyUsageReport {
    return generateMonthlyReport(this.tenantId, period);
  }

  forecastRenewal(): RenewalForecast[] {
    return forecastRenewal(this.tenantId);
  }

  getAuditLog(): readonly LicenseAuditEntry[] {
    return getLicenseAuditLog(this.tenantId);
  }
}
