// Design Ref: §핵심 알고리즘 — 시간대별 집계 + 피크 탐지
// Plan SC: FR-R278.1~5

import { createHash } from 'crypto';

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServiceConfig {
  id: string;
  name: string;
  category: string;
}

interface UsageRecord {
  serviceId: string;
  maskedUserId: string;
  hour: number;
  date: string;
}

interface HourlyPattern {
  serviceId: string;
  hourlyCounts: Record<number, number>;
  peakHour: number;
}

interface TrendResult {
  serviceId: string;
  recentAvg: number;
  previousAvg: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R278.5 — PII 마스킹
function maskUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class PublicServiceUsageAnalyzer {
  private services = new Map<string, ServiceConfig>();
  private usageRecords: UsageRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R278.1
  registerService(id: string, name: string, category: string): void {
    this.services.set(id, { id, name, category });
    this.log('REGISTER_SERVICE', { id, name, category });
  }

  // Plan SC: FR-R278.2
  recordUsage(serviceId: string, userId: string, timestamp: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.services.has(serviceId)) throw new Error(`서비스 미등록: ${serviceId}`);
    const maskedUserId = maskUserId(userId);
    const dt = new Date(timestamp);
    const hour = dt.getUTCHours();
    const date = timestamp.slice(0, 10);
    this.usageRecords.push({ serviceId, maskedUserId, hour, date });
    this.log('RECORD_USAGE', { serviceId, maskedUserId, hour, date });
  }

  // Plan SC: FR-R278.3
  getHourlyPattern(serviceId: string): HourlyPattern {
    const records = this.usageRecords.filter(r => r.serviceId === serviceId);
    const hourlyCounts: Record<number, number> = {};
    for (const r of records) {
      hourlyCounts[r.hour] = (hourlyCounts[r.hour] ?? 0) + 1;
    }
    const peakHour = Object.entries(hourlyCounts).reduce(
      (best, [h, c]) => c > best.count ? { hour: Number(h), count: c } : best,
      { hour: 0, count: -1 }
    ).hour;
    return { serviceId, hourlyCounts, peakHour };
  }

  getPeakHour(serviceId: string): number {
    return this.getHourlyPattern(serviceId).peakHour;
  }

  // Plan SC: FR-R278.4
  analyzeTrend(serviceId: string): TrendResult {
    const records = this.usageRecords.filter(r => r.serviceId === serviceId);
    const dateMap = new Map<string, number>();
    for (const r of records) {
      dateMap.set(r.date, (dateMap.get(r.date) ?? 0) + 1);
    }

    const dates = Array.from(dateMap.keys()).sort();
    const mid = Math.ceil(dates.length / 2);
    const recent = dates.slice(mid);
    const previous = dates.slice(0, mid);

    const avg = (ds: string[]) => ds.length === 0 ? 0 : ds.reduce((s, d) => s + (dateMap.get(d) ?? 0), 0) / ds.length;
    const recentAvg = avg(recent);
    const previousAvg = avg(previous);

    const trend: 'increasing' | 'stable' | 'decreasing' =
      recentAvg > previousAvg * 1.1 ? 'increasing' :
      recentAvg < previousAvg * 0.9 ? 'decreasing' : 'stable';

    return { serviceId, recentAvg, previousAvg, trend };
  }

  // Plan SC: FR-R278.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
