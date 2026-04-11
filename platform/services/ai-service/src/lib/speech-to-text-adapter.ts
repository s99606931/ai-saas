// 음성 회의록 텍스트 변환 어댑터 -- FR-N328.1~FR-N328.4
// Design Ref: MTU-N328 | CSAP: D-06, D-08

export interface AudioMetadata { readonly fileId: string; readonly fileName: string; readonly format: string; readonly durationSeconds: number; readonly sampleRate: number; readonly channels: number; }
export interface SpeakerSegment { readonly segmentId: string; readonly speakerId: string; readonly startTime: number; readonly endTime: number; readonly text: string; readonly confidence: number; }
export interface TranscriptionResult { readonly transcriptionId: string; readonly fileId: string; readonly segments: readonly SpeakerSegment[]; readonly fullText: string; readonly totalDuration: number; readonly speakerCount: number; readonly averageConfidence: number; }
export interface STTAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: STTAuditEntry[] = [];
function recordAudit(entry: Omit<STTAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getSTTAuditLog(tenantId: string): readonly STTAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const SUPPORTED_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'webm'];

export function parseAudioMetadata(fileId: string, fileName: string, durationSeconds: number, sampleRate: number = 16000, channels: number = 1): AudioMetadata {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'unknown';
  if (!SUPPORTED_FORMATS.includes(ext)) throw new Error(`지원하지 않는 음성 형식: ${ext}`);
  return { fileId, fileName, format: ext, durationSeconds, sampleRate, channels };
}

export function createSegment(speakerId: string, startTime: number, endTime: number, text: string, confidence: number = 0.9): SpeakerSegment {
  return { segmentId: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, speakerId, startTime, endTime, text, confidence };
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').replace(/\s+([,.!?])/g, '$1').trim();
}

export function buildTranscription(tenantId: string, metadata: AudioMetadata, segments: SpeakerSegment[]): TranscriptionResult {
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  const fullText = normalizeText(sorted.map(s => s.text).join(' '));
  const speakers = new Set(sorted.map(s => s.speakerId));
  const avgConf = sorted.length > 0 ? sorted.reduce((s, seg) => s + seg.confidence, 0) / sorted.length : 0;
  recordAudit({ actor: 'system', tenantId, action: 'TRANSCRIPTION_COMPLETED', target: metadata.fileId, details: { segments: sorted.length, speakers: speakers.size, duration: metadata.durationSeconds } });
  return { transcriptionId: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, fileId: metadata.fileId, segments: sorted, fullText, totalDuration: metadata.durationSeconds, speakerCount: speakers.size, averageConfidence: avgConf };
}

export class SpeechToTextAdapterService {
  constructor(private readonly tenantId: string) {}
  parseMetadata(fileId: string, fileName: string, duration: number): AudioMetadata { return parseAudioMetadata(fileId, fileName, duration); }
  segment(speaker: string, start: number, end: number, text: string): SpeakerSegment { return createSegment(speaker, start, end, text); }
  transcribe(metadata: AudioMetadata, segments: SpeakerSegment[]): TranscriptionResult { return buildTranscription(this.tenantId, metadata, segments); }
  getAuditLog(): readonly STTAuditEntry[] { return getSTTAuditLog(this.tenantId); }
}
