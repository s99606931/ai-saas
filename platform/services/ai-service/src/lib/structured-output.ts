// Structured Outputs — FR-AI26.3
// Design Ref: SVC-AI-2026 DESIGN §3
// JSON 스키마 제약 LLM 응답 + 파싱 + 검증

import type { LLMMessage } from './llm-provider.js';
import { maskPII } from './pii-masking.js';

export type OutputSchema = 'citizen_request' | 'document_analysis' | 'meeting_summary' | 'risk_assessment';

export interface CitizenRequest {
  category: '교통' | '복지' | '세금' | '민원' | '환경' | '기타';
  subCategory: string;
  priority: '긴급' | '높음' | '보통' | '낮음';
  department: string;
  summary: string;
  keywords: string[];
  requiresHuman: boolean;
  estimatedDays: number;
  sentiment: '긍정' | '중립' | '부정';
}

export interface DocumentAnalysis {
  title: string;
  summary: string;
  keyPoints: string[];
  riskLevel: '높음' | '보통' | '낮음';
  riskItems: string[];
  actionRequired: boolean;
  deadline: string | null;
  documentType: string;
}

export interface MeetingSummary {
  title: string;
  date: string;
  participants: string[];
  decisions: string[];
  actionItems: Array<{ task: string; assignee: string; dueDate: string }>;
  nextMeetingDate: string | null;
}

export interface RiskAssessment {
  overallRisk: '높음' | '보통' | '낮음';
  riskFactors: Array<{ factor: string; level: '높음' | '보통' | '낮음'; mitigation: string }>;
  recommendation: string;
  urgency: boolean;
}

type SchemaResult<T extends OutputSchema> =
  T extends 'citizen_request' ? CitizenRequest :
  T extends 'document_analysis' ? DocumentAnalysis :
  T extends 'meeting_summary' ? MeetingSummary :
  T extends 'risk_assessment' ? RiskAssessment :
  never;

const SCHEMA_PROMPTS: Record<OutputSchema, string> = {
  citizen_request: `다음 민원 내용을 분석하여 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "category": "교통|복지|세금|민원|환경|기타 중 하나",
  "subCategory": "세부 분류",
  "priority": "긴급|높음|보통|낮음 중 하나",
  "department": "담당 부서명",
  "summary": "50자 이내 요약",
  "keywords": ["키워드1", "키워드2"],
  "requiresHuman": true/false,
  "estimatedDays": 처리예상일수(숫자),
  "sentiment": "긍정|중립|부정 중 하나"
}`,
  document_analysis: `다음 문서를 분석하여 반드시 아래 JSON 형식으로만 응답하세요:
{
  "title": "문서 제목",
  "summary": "3문장 요약",
  "keyPoints": ["핵심1", "핵심2", "핵심3"],
  "riskLevel": "높음|보통|낮음 중 하나",
  "riskItems": ["위험항목1"],
  "actionRequired": true/false,
  "deadline": "YYYY-MM-DD 또는 null",
  "documentType": "공문|보고서|계획서|기타"
}`,
  meeting_summary: `다음 회의록을 분석하여 반드시 아래 JSON 형식으로만 응답하세요:
{
  "title": "회의 제목",
  "date": "회의 날짜",
  "participants": ["참석자1", "참석자2"],
  "decisions": ["결정사항1", "결정사항2"],
  "actionItems": [{"task": "업무", "assignee": "담당자", "dueDate": "기한"}],
  "nextMeetingDate": "YYYY-MM-DD 또는 null"
}`,
  risk_assessment: `다음 내용의 위험도를 평가하여 반드시 아래 JSON 형식으로만 응답하세요:
{
  "overallRisk": "높음|보통|낮음 중 하나",
  "riskFactors": [{"factor": "위험요소", "level": "높음|보통|낮음", "mitigation": "완화방안"}],
  "recommendation": "종합 권고사항",
  "urgency": true/false
}`,
};

/**
 * LLM 응답에서 JSON 추출 (마크다운 코드블록 처리 포함)
 */
function extractJSON(text: string): string {
  // ```json ... ``` 블록 추출
  const codeBlockMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(text);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  // 첫 번째 { ... } 추출
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

/**
 * 구조화 출력 생성 메시지 구성
 * 실제 LLM 호출은 호출자(handler)가 담당
 */
export function buildStructuredMessages(schema: OutputSchema, inputText: string): LLMMessage[] {
  const masked = maskPII(inputText);
  return [
    {
      role: 'system',
      content: '당신은 JSON만 출력하는 구조화 분석 AI입니다. 반드시 유효한 JSON만 응답하세요.',
    },
    {
      role: 'user',
      content: `${SCHEMA_PROMPTS[schema]}\n\n=== 분석 대상 ===\n${masked}`,
    },
  ];
}

/**
 * LLM 응답 텍스트를 스키마에 맞게 파싱
 */
export function parseStructuredOutput<T extends OutputSchema>(
  _schema: T, // NOTE: 향후 스키마 기반 검증 로직 추가 예정 (SVC-AI-2026 FR-AI26.3)
  llmResponse: string,
): { success: true; data: SchemaResult<T> } | { success: false; error: string; raw: string } {
  try {
    const jsonStr = extractJSON(llmResponse);
    const parsed = JSON.parse(jsonStr) as SchemaResult<T>;
    return { success: true, data: parsed };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `JSON 파싱 실패: ${errMsg}`, raw: llmResponse.slice(0, 500) };
  }
}
