import { describe, it, expect } from 'vitest';
import { ErpConnectorAi, type ErpAdapter } from '../erp-connector-ai.js';

describe('ErpConnectorAi', () => {
  const adapter: ErpAdapter = {
    id: 'sap-1',
    kind: 'sap',
    baseUrl: 'https://sap.example.kr',
    mappings: [
      { externalField: 'MATNR', internalField: 'materialCode' },
      { externalField: 'PRICE', internalField: 'priceKrw', transform: (v) => Number(v) },
    ],
    auth: { type: 'bearer', credentialRef: 'vault://sap-token' },
  };

  it('정상 동기화 + 매핑', async () => {
    const fetcher = async () => [{ MATNR: 'A-1', PRICE: '1000' }];
    const conn = new ErpConnectorAi(fetcher);
    conn.register(adapter);
    const r = await conn.sync('sap-1', { entity: 'material' });
    expect(r.records[0]).toEqual({ materialCode: 'A-1', priceKrw: 1000 });
    expect(r.result.mapped).toBe(1);
  });

  it('매핑 누락 시 에러 수집', async () => {
    const fetcher = async () => [{ MATNR: 'A-1' }];
    const conn = new ErpConnectorAi(fetcher);
    conn.register(adapter);
    const r = await conn.sync('sap-1', { entity: 'material' });
    expect(r.result.errors.length).toBe(1);
    expect(r.result.mapped).toBe(0);
  });

  it('재시도 후 실패', async () => {
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      throw new Error('network');
    };
    const conn = new ErpConnectorAi(fetcher);
    conn.register(adapter);
    await expect(conn.sync('sap-1', { entity: 'm' })).rejects.toThrow('FETCH_FAILED');
    expect(attempts).toBe(3);
  });

  it('HTTP URL 거부', () => {
    const conn = new ErpConnectorAi(async () => []);
    expect(() => conn.register({ ...adapter, baseUrl: 'http://insecure' })).toThrow('INSECURE_URL');
  });

  it('감사 로그 기록', async () => {
    const conn = new ErpConnectorAi(async () => [{ MATNR: 'X', PRICE: '1' }]);
    conn.register(adapter);
    await conn.sync('sap-1', { entity: 'm' });
    expect(conn.getAuditLog().length).toBe(1);
  });
});
