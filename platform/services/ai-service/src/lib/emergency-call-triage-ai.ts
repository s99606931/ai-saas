// Design Ref: §긴급신고 분류 AI — 키워드/컨텍스트 기반 우선순위 할당
// Plan SC: FR-R585.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ServiceLine = '119' | '112';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Dispatch = 'fire' | 'ambulance' | 'police' | 'rescue' | 'advisory';

export interface CallInput {
  callId: string;
  serviceLine: ServiceLine;
  transcript: string; // 마스킹된 요약 텍스트 (O등급만)
  callerAge?: number;
  locationKnown: boolean;
}

export interface TriageResult {
  callId: string;
  priority: Priority;
  dispatch: Dispatch[];
  keywords: string[];
  rationale: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const KEYWORD_P0 = ['심정지', '호흡정지', '총기', '인질', '흉기', '폭발', '화재확산', '추락'];
const KEYWORD_P1 = ['화재', '교통사고', '의식없음', '출혈', '강도', '폭행', '가스누출'];
const KEYWORD_P2 = ['염좌', '분실', '소음', '경미', '경미한', '도난'];

export class EmergencyCallTriageAI {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  private matchKeywords(text: string): { priority: Priority; hits: string[] } {
    const hits: string[] = [];
    let priority: Priority = 'P3';
    for (const k of KEYWORD_P0) {
      if (text.includes(k)) {
        hits.push(k);
        priority = 'P0';
      }
    }
    if (priority !== 'P0') {
      for (const k of KEYWORD_P1) {
        if (text.includes(k)) {
          hits.push(k);
          priority = 'P1';
        }
      }
    }
    if (priority === 'P3') {
      for (const k of KEYWORD_P2) {
        if (text.includes(k)) {
          hits.push(k);
          priority = 'P2';
        }
      }
    }
    return { priority, hits };
  }

  triage(call: CallInput, grade: DataGrade = 'O'): TriageResult {
    blockClassifiedData(grade);
    if (!call.transcript || call.transcript.length === 0) {
      throw new Error('transcript는 비어있을 수 없음');
    }

    const { priority, hits } = this.matchKeywords(call.transcript);
    const dispatch: Dispatch[] = [];

    if (call.serviceLine === '119') {
      if (hits.some((h) => ['화재', '화재확산', '폭발', '가스누출'].includes(h))) dispatch.push('fire');
      if (hits.some((h) => ['심정지', '호흡정지', '의식없음', '출혈', '추락', '교통사고'].includes(h))) {
        dispatch.push('ambulance');
      }
      if (hits.includes('추락')) dispatch.push('rescue');
    } else {
      if (hits.some((h) => ['총기', '인질', '흉기', '강도', '폭행'].includes(h))) dispatch.push('police');
      if (hits.some((h) => ['교통사고', '출혈'].includes(h))) dispatch.push('ambulance');
    }
    if (dispatch.length === 0) dispatch.push('advisory');

    // 위치 미확인 + 고위험 → 우선순위 상승
    let finalPriority: Priority = priority;
    if (!call.locationKnown && (priority === 'P0' || priority === 'P1')) {
      finalPriority = 'P0';
    }
    // 고령자 보정
    if (call.callerAge !== undefined && call.callerAge >= 75 && priority === 'P2') {
      finalPriority = 'P1';
    }

    const rationale = `키워드 ${hits.length}건, 회선 ${call.serviceLine}, 위치확인 ${call.locationKnown}`;
    this.log('TRIAGE', { callId: call.callId, priority: finalPriority, dispatchCount: dispatch.length });

    return {
      callId: call.callId,
      priority: finalPriority,
      dispatch,
      keywords: hits,
      rationale,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
