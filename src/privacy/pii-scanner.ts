/**
 * PII (개인식별정보) 탐지 스캐너
 * Design Ref: §2.1 | Plan SC: FR-N153.1
 * CSAP D-13: 공공기관 추가 개인정보 보호조치
 * N2SF N-05: 데이터 보호
 */

// PII 패턴 정의 (한국 개인정보보호법 기준)
export const PII_PATTERNS: Record<string, { pattern: RegExp; severity: PIISeverity; description: string }> = {
  residentNumber: {
    pattern: /\d{6}-[1-4]\d{6}/g,
    severity: 'CRITICAL',
    description: '주민등록번호',
  },
  foreignerNumber: {
    pattern: /\d{6}-[5-8]\d{6}/g,
    severity: 'CRITICAL',
    description: '외국인등록번호',
  },
  phoneNumber: {
    pattern: /01[016789]-?\d{3,4}-?\d{4}/g,
    severity: 'HIGH',
    description: '휴대전화번호',
  },
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: 'MEDIUM',
    description: '이메일 주소',
  },
  creditCard: {
    pattern: /\d{4}-?\d{4}-?\d{4}-?\d{4}/g,
    severity: 'CRITICAL',
    description: '신용카드번호',
  },
  passport: {
    pattern: /[A-Z]{1,2}\d{7,8}/g,
    severity: 'HIGH',
    description: '여권번호',
  },
  driverLicense: {
    pattern: /\d{2}-\d{6}-\d{2}/g,
    severity: 'HIGH',
    description: '운전면허번호',
  },
  bankAccount: {
    pattern: /\d{3,4}-\d{2,6}-\d{2,6}-?\d{0,3}/g,
    severity: 'HIGH',
    description: '은행계좌번호',
  },
};

export type PIISeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface PIIScanResult {
  file: string;
  line: number;
  column: number;
  type: string;
  description: string;
  masked: string;
  severity: PIISeverity;
  context: string;
}

/**
 * 텍스트에서 PII 패턴을 탐지합니다
 * // Design Ref: §2.1 | Plan SC: FR-N153.1
 */
export function scanForPII(content: string, filename: string): PIIScanResult[] {
  const results: PIIScanResult[] = [];
  const lines = content.split('\n');

  for (const [type, config] of Object.entries(PII_PATTERNS)) {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const pattern = new RegExp(config.pattern.source, config.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        results.push({
          file: filename,
          line: lineNum + 1,
          column: match.index + 1,
          type,
          description: config.description,
          masked: maskPII(match[0], type),
          severity: config.severity,
          context: line.substring(
            Math.max(0, match.index - 20),
            Math.min(line.length, match.index + match[0].length + 20),
          ),
        });
      }
    }
  }

  return results;
}

/**
 * PII 데이터를 마스킹합니다
 * // Design Ref: §2.1 | Plan SC: FR-N153.1
 */
export function maskPII(value: string, type: string): string {
  switch (type) {
    case 'residentNumber':
    case 'foreignerNumber':
      return value.substring(0, 6) + '-*******';
    case 'phoneNumber':
      return value.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3');
    case 'email':
      const [local, domain] = value.split('@');
      return local.substring(0, 2) + '***@' + domain;
    case 'creditCard':
      return value.substring(0, 4) + '-****-****-' + value.substring(value.length - 4);
    default:
      return '***MASKED***';
  }
}

/**
 * 데이터 등급을 분류합니다 (N2SF 기준)
 * // Design Ref: §2.4 | Plan SC: FR-N153.7
 */
export type DataGrade = 'C' | 'S' | 'O';

export function classifyDataGrade(piiResults: PIIScanResult[]): DataGrade {
  if (piiResults.some((r) => r.severity === 'CRITICAL')) {
    return 'C'; // 기밀 — AI 전송 절대 금지
  }
  if (piiResults.some((r) => r.severity === 'HIGH')) {
    return 'S'; // 민감 — AI 전송 금지
  }
  return 'O'; // 공개 — 마스킹 후 AI 전송 가능
}

/**
 * AI API 전송 전 데이터 등급 검증
 * N2SF N-05: C/S 등급 데이터 AI 전송 절대 금지
 */
export function validateForAITransmission(data: string): { allowed: boolean; grade: DataGrade; reason?: string } {
  const results = scanForPII(data, 'ai-input');
  const grade = classifyDataGrade(results);

  if (grade === 'C') {
    return {
      allowed: false,
      grade,
      reason: `BLOCKED: C등급 데이터 AI 전송 금지 (${results.filter((r) => r.severity === 'CRITICAL').length}건 CRITICAL PII 감지)`,
    };
  }

  if (grade === 'S') {
    return {
      allowed: false,
      grade,
      reason: `BLOCKED: S등급 데이터 AI 전송 금지 (${results.filter((r) => r.severity === 'HIGH').length}건 HIGH PII 감지)`,
    };
  }

  return { allowed: true, grade };
}
