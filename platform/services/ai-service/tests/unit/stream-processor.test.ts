// MTU-N256 단위 테스트: 공공데이터 실시간 스트리밍 파이프라인
// Design Ref: MTU-N256 DESIGN §1~§7
// Plan SC: FR-N256.1~FR-N256.7
// CSAP: D-06 감사, D-08 접근 통제, D-10 네트워크 보안, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  filterTransform,
  mapTransform,
  piiMaskTransform,
  gradeCheckTransform,
  AggregateTransform,
  DeadLetterQueue,
  WebSocketSource,
  FileWatchSource,
  EventBusSink,
  FileSink,
  StreamProcessor,
  PipelineManager,
  createStreamPipeline,
  type StreamEvent,
  type StreamConfig,
} from '../../src/lib/stream-processor.js';

// -- 테스트 헬퍼 ---------------------------------------------------------------

function createEvent(overrides?: Partial<StreamEvent>): StreamEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    tenantId: 'tenant-1',
    source: 'test',
    data: { value: 42 },
    metadata: {},
    grade: 'O',
    ...overrides,
  };
}

// -- 변환 함수 -- Design §3 ---------------------------------------------------

describe('filterTransform', () => {
  it('조건 통과 시 이벤트 유지', () => {
    const transform = filterTransform<{ value: number }>((d) => d.value > 10);
    const event = createEvent({ data: { value: 50 } });
    expect(transform(event)).not.toBeNull();
  });

  it('조건 미통과 시 null (필터링)', () => {
    const transform = filterTransform<{ value: number }>((d) => d.value > 100);
    const event = createEvent({ data: { value: 50 } });
    expect(transform(event)).toBeNull();
  });
});

describe('mapTransform', () => {
  it('데이터를 변환한다', () => {
    const transform = mapTransform<{ value: number }, { doubled: number }>(
      (d) => ({ doubled: d.value * 2 }),
    );
    const event = createEvent({ data: { value: 5 } });
    const result = transform(event);
    expect(result).not.toBeNull();
    expect((result as StreamEvent<{ doubled: number }>).data.doubled).toBe(10);
  });
});

describe('piiMaskTransform', () => {
  it('주민등록번호를 마스킹한다', () => {
    const transform = piiMaskTransform();
    const event = createEvent({ data: { ssn: '950101-1234567' } });
    const result = transform(event)!;
    expect(JSON.stringify(result.data)).toContain('******-*******');
    expect(result.metadata.piiMasked).toBe('true');
  });

  it('이메일을 마스킹한다', () => {
    const transform = piiMaskTransform();
    const event = createEvent({ data: { email: 'user@example.com' } });
    const result = transform(event)!;
    expect(JSON.stringify(result.data)).toContain('***@***.***');
  });

  it('휴대전화번호를 마스킹한다', () => {
    const transform = piiMaskTransform();
    const event = createEvent({ data: { phone: '010-1234-5678' } });
    const result = transform(event)!;
    expect(JSON.stringify(result.data)).toContain('010-****-****');
  });

  it('IP 주소를 마스킹한다', () => {
    const transform = piiMaskTransform();
    const event = createEvent({ data: { ip: '192.168.1.100' } });
    const result = transform(event)!;
    expect(JSON.stringify(result.data)).toContain('***.***.***.***');
  });

  it('PII 없으면 데이터 보존', () => {
    const transform = piiMaskTransform();
    const event = createEvent({ data: { message: '안녕하세요' } });
    const result = transform(event)!;
    expect(JSON.stringify(result.data)).toContain('안녕하세요');
  });
});

describe('gradeCheckTransform', () => {
  it('O등급은 통과', () => {
    const transform = gradeCheckTransform();
    const event = createEvent({ grade: 'O' });
    expect(transform(event)).not.toBeNull();
  });

  it('O등급이 아니면 차단 (null)', () => {
    const transform = gradeCheckTransform();
    // StreamEvent의 grade 타입은 'O'뿐이지만 런타임 검증 테스트
    const event = createEvent();
    (event as any).grade = 'C';
    expect(transform(event)).toBeNull();
  });
});

// -- AggregateTransform -- Design §3.3 -----------------------------------------

describe('AggregateTransform', () => {
  it('윈도우에 이벤트를 축적한다', () => {
    const agg = new AggregateTransform<number>(
      5000,
      (events) => createEvent({ data: { count: events.length } }),
    );

    const r1 = agg.process(createEvent({ data: 1 }));
    const r2 = agg.process(createEvent({ data: 2 }));
    expect(r1).toBeNull(); // 집계 중
    expect(r2).toBeNull();
    expect(agg.getWindowSize()).toBe(2);
  });

  it('flush로 집계 결과를 반환한다', () => {
    const agg = new AggregateTransform<number>(
      5000,
      (events) => createEvent({ data: { count: events.length } }),
    );

    agg.process(createEvent({ data: 1 }));
    agg.process(createEvent({ data: 2 }));
    agg.process(createEvent({ data: 3 }));

    const result = agg.flush()!;
    expect(result).not.toBeNull();
    expect((result.data as { count: number }).count).toBe(3);
    expect(agg.getWindowSize()).toBe(0); // 비워짐
  });

  it('빈 윈도우 flush는 null', () => {
    const agg = new AggregateTransform<number>(
      5000,
      (events) => createEvent({ data: { count: events.length } }),
    );
    expect(agg.flush()).toBeNull();
  });
});

// -- DeadLetterQueue -- Design §5 -----------------------------------------------

describe('DeadLetterQueue', () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue(100);
  });

  it('실패 이벤트를 추가한다', () => {
    dlq.enqueue(createEvent({ id: 'e1' }), '처리 실패');
    expect(dlq.size()).toBe(1);
  });

  it('동일 이벤트 재추가 시 시도 횟수가 증가한다', () => {
    const event = createEvent({ id: 'e1' });
    dlq.enqueue(event, '첫 실패');
    dlq.enqueue(event, '두번째 실패');
    expect(dlq.size()).toBe(1);
    const items = dlq.getAll();
    expect(items[0]!.attempts).toBe(2);
    expect(items[0]!.error).toBe('두번째 실패');
  });

  it('재시도 가능한 항목을 조회한다', () => {
    const e1 = createEvent({ id: 'e1' });
    const e2 = createEvent({ id: 'e2' });
    dlq.enqueue(e1, '실패');
    dlq.enqueue(e2, '실패');
    dlq.enqueue(e2, '실패'); // 2회
    dlq.enqueue(e2, '실패'); // 3회
    dlq.enqueue(e2, '실패'); // 4회

    const retryable = dlq.getRetryable(3);
    expect(retryable).toHaveLength(1); // e1만 (1 <= 3)
  });

  it('영구 실패 항목을 조회한다', () => {
    const e1 = createEvent({ id: 'e1' });
    dlq.enqueue(e1, '실패');
    dlq.enqueue(e1, '실패');
    dlq.enqueue(e1, '실패');
    dlq.enqueue(e1, '실패'); // 4회

    const permanent = dlq.getPermanentlyFailed(3);
    expect(permanent).toHaveLength(1); // 4 > 3
  });

  it('항목을 제거한다', () => {
    dlq.enqueue(createEvent({ id: 'e1' }), '실패');
    dlq.enqueue(createEvent({ id: 'e2' }), '실패');
    expect(dlq.remove('e1')).toBe(true);
    expect(dlq.size()).toBe(1);
    expect(dlq.remove('e999')).toBe(false);
  });

  it('DLQ를 비운다', () => {
    dlq.enqueue(createEvent({ id: 'e1' }), '실패');
    dlq.enqueue(createEvent({ id: 'e2' }), '실패');
    dlq.clear();
    expect(dlq.size()).toBe(0);
  });

  it('maxSize 초과 시 오래된 항목 제거', () => {
    const smallDlq = new DeadLetterQueue(3);
    smallDlq.enqueue(createEvent({ id: 'e1' }), '실패');
    smallDlq.enqueue(createEvent({ id: 'e2' }), '실패');
    smallDlq.enqueue(createEvent({ id: 'e3' }), '실패');
    smallDlq.enqueue(createEvent({ id: 'e4' }), '실패'); // e1 제거
    expect(smallDlq.size()).toBe(3);
    const ids = smallDlq.getAll().map((i) => i.event.id);
    expect(ids).not.toContain('e1');
    expect(ids).toContain('e4');
  });
});

// -- WebSocketSource -- Design §2.2 --------------------------------------------

describe('WebSocketSource', () => {
  it('연결 후 메시지를 주입한다', async () => {
    const source = new WebSocketSource({ url: 'ws://test', tenantId: 't1' });
    const received: StreamEvent[] = [];
    source.on('data', (evt) => received.push(evt));

    await source.start();
    expect(source.isConnected()).toBe(true);
    source.injectMessage({ test: 'data' });

    expect(received).toHaveLength(1);
    expect(received[0]!.tenantId).toBe('t1');
  });

  it('정지 후 메시지 무시', async () => {
    const source = new WebSocketSource({ url: 'ws://test', tenantId: 't1' });
    const received: StreamEvent[] = [];
    source.on('data', (evt) => received.push(evt));

    await source.start();
    await source.stop();
    source.injectMessage({ test: 'data' });

    expect(received).toHaveLength(0);
    expect(source.isConnected()).toBe(false);
  });

  it('일시 정지 중 메시지 무시', async () => {
    const source = new WebSocketSource({ url: 'ws://test', tenantId: 't1' });
    const received: StreamEvent[] = [];
    source.on('data', (evt) => received.push(evt));

    await source.start();
    source.pause();
    source.injectMessage({ test: 'data' });

    expect(received).toHaveLength(0);

    source.resume();
    source.injectMessage({ test: 'after resume' });
    expect(received).toHaveLength(1);
  });
});

// -- FileWatchSource -- Design §2.3 -------------------------------------------

describe('FileWatchSource', () => {
  it('파일 이벤트를 주입한다', async () => {
    const source = new FileWatchSource({ directory: '/data', tenantId: 't1' });
    const received: StreamEvent[] = [];
    source.on('data', (evt) => received.push(evt));

    await source.start();
    source.injectFileEvent('/data/file.csv', { rows: 10 });

    expect(received).toHaveLength(1);
    expect(source.isWatching()).toBe(true);
  });
});

// -- EventBusSink -- Design §4.2 -----------------------------------------------

describe('EventBusSink', () => {
  it('이벤트를 버퍼에 저장한다', async () => {
    const sink = new EventBusSink({ channel: 'test-channel' });
    await sink.write([createEvent(), createEvent()]);
    expect(sink.getBuffer()).toHaveLength(2);
  });

  it('테넌트 ID 없는 이벤트를 차단한다', async () => {
    const sink = new EventBusSink({ channel: 'test' });
    const badEvent = createEvent();
    badEvent.tenantId = '';
    await expect(sink.write([badEvent])).rejects.toThrow('테넌트 ID');
  });

  it('publishFn이 있으면 발행한다', async () => {
    const published: StreamEvent[][] = [];
    const sink = new EventBusSink({
      channel: 'test',
      publishFn: async (_, events) => { published.push(events); },
    });
    const events = [createEvent(), createEvent()];
    await sink.write(events);
    expect(published).toHaveLength(1);
    expect(published[0]).toHaveLength(2);
    expect(sink.getBuffer()).toHaveLength(0); // publishFn 사용 시 버퍼에 안 쌓임
  });

  it('flush로 버퍼를 비운다', async () => {
    const sink = new EventBusSink({ channel: 'test' });
    await sink.write([createEvent()]);
    await sink.flush();
    expect(sink.getBuffer()).toHaveLength(0);
  });
});

// -- FileSink -- Design §4.3 ---------------------------------------------------

describe('FileSink', () => {
  it('레코드를 저장한다', async () => {
    const sink = new FileSink({ outputPath: '/tmp/out.json', format: 'json' });
    await sink.write([createEvent(), createEvent()]);
    expect(sink.getRecords()).toHaveLength(2);
  });
});

// -- PipelineManager -- Design §7 -----------------------------------------------

describe('PipelineManager', () => {
  let manager: PipelineManager;

  beforeEach(() => {
    manager = new PipelineManager();
  });

  it('파이프라인을 등록/조회한다', () => {
    const p = createStreamPipeline('pipe-1', 'tenant-1');
    manager.register(p);
    expect(manager.size()).toBe(1);
    expect(manager.get('tenant-1', 'pipe-1')).toBe(p);
  });

  it('테넌트별 파이프라인을 조회한다', () => {
    manager.register(createStreamPipeline('p1', 't1'));
    manager.register(createStreamPipeline('p2', 't1'));
    manager.register(createStreamPipeline('p3', 't2'));

    expect(manager.getByTenant('t1')).toHaveLength(2);
    expect(manager.getByTenant('t2')).toHaveLength(1);
    expect(manager.getByTenant('t3')).toHaveLength(0);
  });

  it('파이프라인을 등록 해제한다', () => {
    manager.register(createStreamPipeline('p1', 't1'));
    expect(manager.unregister('t1', 'p1')).toBe(true);
    expect(manager.size()).toBe(0);
  });

  it('전체 메트릭을 조회한다', () => {
    manager.register(createStreamPipeline('p1', 't1'));
    manager.register(createStreamPipeline('p2', 't2'));
    const metrics = manager.getAllMetrics();
    expect(metrics).toHaveLength(2);
    expect(metrics[0]!.state).toBe('idle');
  });
});

// -- StreamProcessor 메트릭 -------------------------------------------------------

describe('StreamProcessor 메트릭', () => {
  it('초기 메트릭을 반환한다', () => {
    const p = createStreamPipeline('test', 'tenant-1');
    const metrics = p.getMetrics();
    expect(metrics.pipelineId).toBe('test');
    expect(metrics.tenantId).toBe('tenant-1');
    expect(metrics.eventsReceived).toBe(0);
    expect(metrics.state).toBe('idle');
  });

  it('DLQ에 접근할 수 있다', () => {
    const p = createStreamPipeline('test', 'tenant-1');
    const dlq = p.getDlq();
    expect(dlq.size()).toBe(0);
  });
});

// -- createStreamPipeline 팩토리 ------------------------------------------------

describe('createStreamPipeline', () => {
  it('기본 설정으로 파이프라인을 생성한다', () => {
    const p = createStreamPipeline('pipe-1', 'tenant-1');
    const metrics = p.getMetrics();
    expect(metrics.pipelineId).toBe('pipe-1');
    expect(metrics.tenantId).toBe('tenant-1');
  });

  it('사용자 정의 옵션을 적용한다', () => {
    const p = createStreamPipeline('pipe-2', 'tenant-2', {
      batchSize: 50,
      maxBufferSize: 5000,
    });
    expect(p.getState()).toBe('idle');
  });
});
