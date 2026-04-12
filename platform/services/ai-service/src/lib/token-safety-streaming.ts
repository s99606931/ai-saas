// Token-level Safety Streaming — FR-R66.1~R66.5
// Design Ref: SVC-AI-ADV-R66 DESIGN §모듈
// Plan SC: 유해 출력 차단 99%, 오탐 5% 이하
// CSAP: D-06 감사 / D-12 입력검증 / D-09 시크릿
// N2SF: N-05 등급

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';
export type SafetyAction = 'allow' | 'mask' | 'interrupt';

export interface DetectionResult {
  action: SafetyAction;
  reason?: string;
  detectorId: string;
  span?: { start: number; end: number };
}

export interface Detector {
  id: string;
  inspect(window: string, fullText?: string): DetectionResult | null;
}

export interface StreamConfig {
  windowSize?: number;
  grade: DataGrade;
  safeFallback?: string;
  detectors?: Detector[];
}

export type StreamEventType =
  | 'token'
  | 'masked'
  | 'blocked'
  | 'interrupted'
  | 'completed';

export interface StreamEvent {
  type: StreamEventType;
  token?: string;
  reason?: string;
  detectorId?: string;
  timestamp: string;
  tokenIndex: number;
}

export type SafetyAuditAction =
  | 'STREAM_START'
  | 'TOKEN_ALLOW'
  | 'TOKEN_MASK'
  | 'STREAM_INTERRUPT'
  | 'STREAM_END'
  | 'GRADE_BLOCK';

export interface SafetyAuditEntry {
  timestamp: string;
  action: SafetyAuditAction;
  detectorId?: string;
  reason?: string;
  tokenIndex?: number;
}

// ── 기본 탐지기 ──────────────────────────────────────────────────────────────

export class PiiDetector implements Detector {
  public id = 'pii';
  private patterns: { name: string; re: RegExp }[] = [
    { name: 'rrn', re: /\d{6}-\d{7}/ },
    { name: 'phone', re: /01[016789]-?\d{3,4}-?\d{4}/ },
    { name: 'email', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
    { name: 'account', re: /\b\d{3}-\d{2}-\d{6}\b/ },
    { name: 'card', re: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/ },
  ];

  public inspect(window: string, _fullText?: string): DetectionResult | null {
    for (const p of this.patterns) {
      const m = p.re.exec(window);
      if (m) {
        return {
          action: 'mask',
          reason: `PII:${p.name}`,
          detectorId: this.id,
          span: { start: m.index, end: m.index + m[0].length },
        };
      }
    }
    return null;
  }
}

export class KeywordDetector implements Detector {
  public id = 'keyword';
  private keywords: string[];

  public constructor(keywords: string[]) {
    this.keywords = keywords.map((k) => k.toLowerCase());
  }

  public inspect(window: string, _fullText?: string): DetectionResult | null {
    const lower = window.toLowerCase();
    for (const kw of this.keywords) {
      const idx = lower.indexOf(kw);
      if (idx >= 0) {
        return {
          action: 'interrupt',
          reason: `keyword:${kw}`,
          detectorId: this.id,
          span: { start: idx, end: idx + kw.length },
        };
      }
    }
    return null;
  }
}

export class JailbreakDetector implements Detector {
  public id = 'jailbreak';
  private patterns: RegExp[] = [
    /ignore\s+(?:all\s+)?previous\s+instructions/i,
    /system\s+prompt/i,
    /prompt\s+leak/i,
    /disregard\s+your\s+rules/i,
  ];

  public inspect(window: string, _fullText?: string): DetectionResult | null {
    for (const re of this.patterns) {
      const m = re.exec(window);
      if (m) {
        return {
          action: 'interrupt',
          reason: 'jailbreak-attempt',
          detectorId: this.id,
          span: { start: m.index, end: m.index + m[0].length },
        };
      }
    }
    return null;
  }
}

export class SecretLeakDetector implements Detector {
  public id = 'secret';
  private patterns: RegExp[] = [
    /sk-[A-Za-z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[A-Za-z0-9]{30,}/,
    /xoxb-[A-Za-z0-9-]{20,}/,
  ];

  public inspect(window: string, _fullText?: string): DetectionResult | null {
    for (const re of this.patterns) {
      const m = re.exec(window);
      if (m) {
        return {
          action: 'interrupt',
          reason: 'secret-leak',
          detectorId: this.id,
          span: { start: m.index, end: m.index + m[0].length },
        };
      }
    }
    return null;
  }
}

// ── 메인 클래스 ──────────────────────────────────────────────────────────────

export class TokenSafetyStream {
  private readonly windowSize: number;
  private readonly grade: DataGrade;
  private readonly safeFallback: string;
  private readonly detectors: Detector[];
  private window = '';
  private fullText = '';
  private tokenIndex = 0;
  private interrupted = false;
  private completed = false;
  private readonly audit: SafetyAuditEntry[] = [];
  private readonly events: StreamEvent[] = [];

  public constructor(cfg: StreamConfig) {
    if (cfg.grade !== 'O') {
      this.record('GRADE_BLOCK', { reason: `grade:${cfg.grade}` });
      throw new Error('SAFETY_GRADE_BLOCKED');
    }
    this.windowSize = cfg.windowSize ?? 128;
    this.grade = cfg.grade;
    this.safeFallback =
      cfg.safeFallback ?? '[안전 정책에 의해 응답이 중단되었습니다]';
    this.detectors = cfg.detectors ?? [
      new PiiDetector(),
      new JailbreakDetector(),
      new SecretLeakDetector(),
    ];
    this.record('STREAM_START');
  }

  public push(token: string): StreamEvent {
    if (this.interrupted || this.completed) {
      throw new Error('SAFETY_STREAM_CLOSED');
    }
    this.fullText += token;
    this.window = (this.window + token).slice(-this.windowSize);
    const currentIdx = this.tokenIndex;
    this.tokenIndex += 1;

    for (const d of this.detectors) {
      const res = d.inspect(this.window, this.fullText);
      if (!res) continue;
      if (res.action === 'interrupt') {
        this.interrupted = true;
        this.record('STREAM_INTERRUPT', {
          detectorId: res.detectorId,
          reason: res.reason,
          tokenIndex: currentIdx,
        });
        const ev: StreamEvent = {
          type: 'interrupted',
          reason: res.reason,
          detectorId: res.detectorId,
          token: this.safeFallback,
          timestamp: new Date().toISOString(),
          tokenIndex: currentIdx,
        };
        this.events.push(ev);
        return ev;
      }
      if (res.action === 'mask') {
        this.record('TOKEN_MASK', {
          detectorId: res.detectorId,
          reason: res.reason,
          tokenIndex: currentIdx,
        });
        const masked = '*'.repeat(token.length);
        const ev: StreamEvent = {
          type: 'masked',
          token: masked,
          reason: res.reason,
          detectorId: res.detectorId,
          timestamp: new Date().toISOString(),
          tokenIndex: currentIdx,
        };
        this.events.push(ev);
        return ev;
      }
    }

    this.record('TOKEN_ALLOW', { tokenIndex: currentIdx });
    const ev: StreamEvent = {
      type: 'token',
      token,
      timestamp: new Date().toISOString(),
      tokenIndex: currentIdx,
    };
    this.events.push(ev);
    return ev;
  }

  public end(): StreamEvent {
    if (this.completed) throw new Error('SAFETY_STREAM_ALREADY_ENDED');
    this.completed = true;
    this.record('STREAM_END', { tokenIndex: this.tokenIndex });
    const ev: StreamEvent = {
      type: 'completed',
      timestamp: new Date().toISOString(),
      tokenIndex: this.tokenIndex,
    };
    this.events.push(ev);
    return ev;
  }

  public isInterrupted(): boolean {
    return this.interrupted;
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public getGrade(): DataGrade {
    return this.grade;
  }

  public getFullText(): string {
    return this.fullText;
  }

  public getEvents(): StreamEvent[] {
    return [...this.events];
  }

  public getAuditLog(): SafetyAuditEntry[] {
    return [...this.audit];
  }

  private record(
    action: SafetyAuditAction,
    extra: Partial<SafetyAuditEntry> = {},
  ): void {
    this.audit.push({
      timestamp: new Date().toISOString(),
      action,
      ...extra,
    });
  }
}
