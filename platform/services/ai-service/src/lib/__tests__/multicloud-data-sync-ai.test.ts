import { describe, it, expect, beforeEach } from 'vitest';
import { MulticloudDataSyncAI } from '../multicloud-data-sync-ai';

describe('MulticloudDataSyncAI', () => {
  let syncManager: MulticloudDataSyncAI;

  beforeEach(() => {
    syncManager = new MulticloudDataSyncAI();
  });

  it('데이터소스를 등록한다', () => {
    syncManager.registerDataSource('aws', 'AWS S3', 'aws', 'ap-northeast-2');
    const logs = syncManager.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_DATA_SOURCE')).toBe(true);
  });

  it('변경을 기록한다', () => {
    syncManager.registerDataSource('aws', 'AWS', 'aws', 'ap-northeast-2');
    syncManager.recordChange('aws', 'res-1', 1, { value: 'hello' });
    const logs = syncManager.getAuditLog();
    expect(logs.some(l => l.action === 'RECORD_CHANGE')).toBe(true);
  });

  it('충돌을 탐지한다 (두 소스가 같은 리소스를 다른 버전으로 수정)', () => {
    syncManager.registerDataSource('aws', 'AWS', 'aws', 'ap-northeast-2');
    syncManager.registerDataSource('gcp', 'GCP', 'gcp', 'asia-east1');
    syncManager.recordChange('aws', 'res-1', 1, { value: 'aws-data' });
    syncManager.recordChange('gcp', 'res-1', 2, { value: 'gcp-data' });
    const conflicts = syncManager.detectConflicts('res-1');
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.conflictType).toBe('concurrent_modification');
  });

  it('충돌 없으면 빈 배열을 반환한다', () => {
    syncManager.registerDataSource('aws', 'AWS', 'aws', 'ap-northeast-2');
    syncManager.recordChange('aws', 'res-2', 1, { value: 'data' });
    const conflicts = syncManager.detectConflicts('res-2');
    expect(conflicts.length).toBe(0);
  });

  it('last-write-wins 동기화 계획을 생성한다', () => {
    syncManager.registerDataSource('aws', 'AWS', 'aws', 'us-east-1');
    syncManager.registerDataSource('gcp', 'GCP', 'gcp', 'us-central1');
    syncManager.recordChange('aws', 'res-3', 1, { key: 'v1' });
    syncManager.recordChange('gcp', 'res-3', 2, { key: 'v2' });
    const plan = syncManager.generateSyncPlan('res-3', 'last-write-wins');
    expect(plan.strategy).toBe('last-write-wins');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.hasConflicts).toBe(true);
  });

  it('merge 동기화 계획을 생성한다', () => {
    syncManager.registerDataSource('aws', 'AWS', 'aws', 'us-east-1');
    syncManager.registerDataSource('gcp', 'GCP', 'gcp', 'us-central1');
    syncManager.recordChange('aws', 'res-4', 1, { keyA: 'v1' });
    syncManager.recordChange('gcp', 'res-4', 2, { keyB: 'v2' });
    const plan = syncManager.generateSyncPlan('res-4', 'merge');
    expect(plan.strategy).toBe('merge');
    expect(plan.steps.every(s => s.action === 'merge')).toBe(true);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    syncManager.registerDataSource('aws', 'AWS', 'aws', 'us-east-1');
    expect(() => syncManager.recordChange('aws', 'res-5', 1, { data: 'x' }, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 소스 변경 기록 시 오류를 던진다', () => {
    expect(() => syncManager.recordChange('unknown', 'res-1', 1, {})).toThrow('데이터소스 미등록');
  });
});
