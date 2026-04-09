// 프롬프트 인젝션 방어
// Design Ref: SVC-AI-R1 DESIGN §1
// Plan SC: FR-AI.1
// CSAP: D-12 시스템 개발 보안 — AI 프롬프트 보안

/**
 * 프롬프트 인젝션 탐지 패턴
 *
 * 각 패턴에 심각도 가중치를 부여합니다.
 * 총 심각도가 임계값을 초과하면 요청을 차단합니다.
 */
const INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  severity: number;
  description: string;
}> = [
  {
    pattern: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i,
    severity: 10,
    description: '이전 지시 무시 시도',
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|the)\s+/i,
    severity: 8,
    description: '역할 변경 시도',
  },
  {
    pattern: /system\s*:\s*you\s+are/i,
    severity: 10,
    description: '시스템 프롬프트 주입',
  },
  {
    pattern: /jailbreak|dan\s+mode|developer\s+mode|unrestricted\s+mode/i,
    severity: 10,
    description: '탈옥 시도',
  },
  {
    pattern: /pretend\s+you\s+(are|have|can)/i,
    severity: 6,
    description: '역할 위장 시도',
  },
  {
    pattern: /bypass\s+(safety|filter|restriction|guard)/i,
    severity: 9,
    description: '안전장치 우회 시도',
  },
  {
    pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i,
    severity: 8,
    description: '시스템 프롬프트 노출 시도',
  },
  {
    pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
    severity: 9,
    description: '특수 토큰 주입 시도',
  },
  {
    pattern: /act\s+as\s+(if\s+)?you\s+(were|are)\s+(a\s+)?/i,
    severity: 5,
    description: '행동 변경 시도',
  },
  {
    pattern: /forget\s+(everything|all|what)/i,
    severity: 7,
    description: '컨텍스트 초기화 시도',
  },
];

/** 차단 임계값 */
const BLOCK_THRESHOLD = parseInt(process.env['PROMPT_GUARD_THRESHOLD'] ?? '8', 10);

/**
 * 프롬프트 인젝션 검사 결과
 */
export interface PromptGuardResult {
  /** 차단 여부 */
  blocked: boolean;
  /** 총 심각도 점수 */
  totalSeverity: number;
  /** 탐지된 패턴 목록 */
  detections: Array<{
    description: string;
    severity: number;
  }>;
}

/**
 * 프롬프트 인젝션 검사
 *
 * 사용자 입력에서 알려진 인젝션 패턴을 탐지합니다.
 * 총 심각도가 임계값을 초과하면 차단 플래그를 설정합니다.
 *
 * @param prompt - 검사할 프롬프트 텍스트
 * @returns 검사 결과
 */
export function checkPromptInjection(prompt: string): PromptGuardResult {
  const detections: PromptGuardResult['detections'] = [];
  let totalSeverity = 0;

  for (const rule of INJECTION_PATTERNS) {
    if (rule.pattern.test(prompt)) {
      detections.push({
        description: rule.description,
        severity: rule.severity,
      });
      totalSeverity += rule.severity;
    }
  }

  return {
    blocked: totalSeverity >= BLOCK_THRESHOLD,
    totalSeverity,
    detections,
  };
}
