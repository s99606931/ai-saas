// Design Ref: MTU-N447 §음성 인터페이스 AI
// Plan SC: FR-N447.1~5

export interface SttResult {
  text: string;
  confidence: number;
  language: string;
  durationMs: number;
}

export type Intent = 'command' | 'query' | 'navigate' | 'unknown';

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  entities: Record<string, string>;
}

export interface CommandRoute {
  action: string;
  params: Record<string, string>;
  target: string;
}

export interface TtsRequest {
  text: string;
  voice: string;
  speedRate: number;
}

export interface ConversationTurn {
  timestamp: number;
  userText: string;
  intent: Intent;
  responseText: string;
}

export class VoiceInterfaceAi {
  /** FR-N447.1 STT 결과 검증 */
  validateStt(result: SttResult): boolean {
    return result.confidence >= 0.5 && result.text.length > 0;
  }

  /** FR-N447.2 의도 분류 (규칙 기반) */
  classifyIntent(text: string): IntentClassification {
    const lower = text.toLowerCase();
    const entities: Record<string, string> = {};

    const pageMatch = lower.match(/(대시보드|설정|사용자|보고서|로그)/);
    if (pageMatch?.[1]) entities['page'] = pageMatch[1];

    if (/이동|열어|보여|가자/.test(lower)) {
      return { intent: 'navigate', confidence: 0.9, entities };
    }
    if (/생성|삭제|수정|실행|등록/.test(lower)) {
      return { intent: 'command', confidence: 0.85, entities };
    }
    if (/알려|뭐|어떻|어떤|얼마|있어/.test(lower) || text.endsWith('?')) {
      return { intent: 'query', confidence: 0.8, entities };
    }
    return { intent: 'unknown', confidence: 0.3, entities };
  }

  /** FR-N447.3 명령 실행 라우팅 */
  routeCommand(classification: IntentClassification): CommandRoute | null {
    if (classification.intent === 'navigate') {
      return {
        action: 'navigate',
        params: classification.entities,
        target: classification.entities['page'] ?? 'home',
      };
    }
    if (classification.intent === 'command') {
      return { action: 'execute', params: classification.entities, target: 'command-dispatcher' };
    }
    return null;
  }

  /** FR-N447.4 TTS 요청 생성 */
  buildTtsRequest(text: string, voice = 'ko-KR-neural', speedRate = 1.0): TtsRequest {
    return { text, voice, speedRate };
  }

  /** FR-N447.5 대화 이력 추가 */
  appendTurn(
    history: ConversationTurn[],
    turn: Omit<ConversationTurn, 'timestamp'>,
    timestamp: number,
  ): ConversationTurn[] {
    return [...history, { ...turn, timestamp }].slice(-50);
  }
}

export const voiceInterfaceAi = new VoiceInterfaceAi();
