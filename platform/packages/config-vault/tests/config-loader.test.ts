// ConfigLoader 단위 테스트
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.2

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigLoader, ConfigError } from '../src/config-loader.js';

describe('ConfigLoader', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
  });

  describe('기본 설정', () => {
    it('기본 설정을 로드한다', () => {
      loader.loadDefaults({ db: { host: 'localhost', port: 5432 } });

      expect(loader.get('db.host')).toBe('localhost');
      expect(loader.get('db.port')).toBe(5432);
    });

    it('존재하지 않는 키에 기본값을 반환한다', () => {
      expect(loader.get('missing', 'fallback')).toBe('fallback');
    });

    it('존재하지 않는 키에 기본값 없으면 에러를 발생한다', () => {
      expect(() => loader.get('missing')).toThrow(ConfigError);
    });
  });

  describe('계층형 우선순위', () => {
    it('환경별 설정이 기본 설정을 덮어쓴다', () => {
      loader.loadDefaults({ db: { host: 'localhost', port: 5432 } });
      loader.loadEnvironmentConfig({ db: { host: 'prod-db.internal' } });

      expect(loader.get('db.host')).toBe('prod-db.internal');
      expect(loader.get('db.port')).toBe(5432); // 기본값 유지
    });

    it('런타임 설정이 최고 우선순위다', () => {
      loader.loadDefaults({ app: { name: 'default' } });
      loader.loadEnvironmentConfig({ app: { name: 'production' } });
      loader.set('app.name', 'runtime-override');

      expect(loader.get('app.name')).toBe('runtime-override');
    });
  });

  describe('has()', () => {
    it('존재하는 키에 true를 반환한다', () => {
      loader.loadDefaults({ server: { port: 3000 } });
      expect(loader.has('server.port')).toBe(true);
    });

    it('존재하지 않는 키에 false를 반환한다', () => {
      expect(loader.has('nonexistent')).toBe(false);
    });
  });

  describe('런타임 변경', () => {
    it('set()으로 런타임 설정을 변경한다', () => {
      loader.loadDefaults({ feature: { enabled: false } });
      loader.set('feature.enabled', true);

      expect(loader.get('feature.enabled')).toBe(true);
    });

    it('변경 이벤트를 리스너에 알린다', () => {
      const events: { key: string; newValue: unknown }[] = [];
      loader.onChange((e) => events.push({ key: e.key, newValue: e.newValue }));

      loader.set('test.key', 'value');

      expect(events).toHaveLength(1);
      expect(events[0]!.key).toBe('test.key');
      expect(events[0]!.newValue).toBe('value');
    });

    it('변경 이력을 기록한다', () => {
      loader.set('a', 1);
      loader.set('b', 2);

      const log = loader.getChangeLog();
      expect(log).toHaveLength(2);
      expect(log[0]!.key).toBe('a');
      expect(log[1]!.key).toBe('b');
    });
  });

  describe('getAll()', () => {
    it('전체 병합된 설정을 반환한다', () => {
      loader.loadDefaults({ a: 1, b: 2 });
      loader.loadEnvironmentConfig({ b: 3, c: 4 });

      const all = loader.getAll();
      expect(all).toEqual({ a: 1, b: 3, c: 4 });
    });
  });

  describe('깊은 병합', () => {
    it('중첩 객체를 깊게 병합한다', () => {
      loader.loadDefaults({
        db: { host: 'localhost', port: 5432, pool: { min: 2, max: 10 } },
      });
      loader.loadEnvironmentConfig({
        db: { host: 'prod-db', pool: { max: 50 } },
      });

      expect(loader.get('db.host')).toBe('prod-db');
      expect(loader.get('db.port')).toBe(5432);
      expect(loader.get<number>('db.pool.min')).toBe(2);
      expect(loader.get<number>('db.pool.max')).toBe(50);
    });
  });
});
