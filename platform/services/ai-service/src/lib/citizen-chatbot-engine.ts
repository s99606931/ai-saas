// 시민 상담 챗봇 엔진 -- FR-N313.1~FR-N313.4
// Design Ref: MTU-N313
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안

export type IntentCategory = 'civil_complaint' | 'info_request' | 'service_guide' | 'faq' | 'escalation' | 'unknown';
export interface ChatMessage { readonly messageId: string; readonly sessionId: string; readonly role: 'user' | 'assistant'; readonly content: string; readonly timestamp: string; }
export interface IntentResult { readonly intent: IntentCategory; readonly confidence: number; readonly entities: Record<string, string>; }
export interface ChatResponse { readonly responseId: string; readonly sessionId: string; readonly message: string; readonly intent: IntentCategory; readonly confidence: number; readonly suggestedActions: string[]; readonly escalated: boolean; readonly respondedAt: string; }
export interface ChatAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ChatAuditEntry[] = [];
function recordAudit(entry: Omit<ChatAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getChatAuditLog(tenantId: string): readonly ChatAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
  civil_complaint: ['민원', '불만', '신고', '고발', '항의', '시정'],
  info_request: ['문의', '알려', '확인', '어디', '언제', '어떻게'],
  service_guide: ['안내', '절차', '방법', '신청', '등록', '발급'],
  faq: ['자주', '질문', 'FAQ', '많이'],
  escalation: ['상담원', '담당자', '직접', '전화', '연결'],
  unknown: [],
};

const FAQ_DATABASE: readonly { question: string; answer: string; category: IntentCategory }[] = [
  { question: '주민등록등본 발급', answer: '정부24(gov.kr)에서 온라인 발급 가능합니다. 주민센터 방문 발급도 가능합니다.', category: 'service_guide' },
  { question: '민원 처리 기간', answer: '일반 민원은 7일 이내, 복합 민원은 14일 이내 처리됩니다.', category: 'faq' },
  { question: '정보공개 청구', answer: '정보공개포털(open.go.kr)에서 온라인 청구 가능합니다.', category: 'service_guide' },
];

export function maskChatPII(text: string): string {
  return text.replace(/\d{6}[-]?\d{7}/g, '[주민번호마스킹]').replace(/01[0-9][-]?\d{3,4}[-]?\d{4}/g, '[전화마스킹]');
}

export function classifyIntent(message: string): IntentResult {
  const lower = message.toLowerCase();
  const entities: Record<string, string> = {};
  let bestIntent: IntentCategory = 'unknown';
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matched = keywords.filter(kw => lower.includes(kw));
    const score = keywords.length > 0 ? matched.length / keywords.length : 0;
    if (score > bestScore) { bestScore = score; bestIntent = intent as IntentCategory; }
  }

  // 엔티티 추출 (간소화)
  const dateMatch = message.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (dateMatch) entities['date'] = dateMatch[0];

  return { intent: bestIntent, confidence: Math.min(0.95, bestScore + 0.3), entities };
}

export function generateResponse(tenantId: string, sessionId: string, userMessage: string): ChatResponse {
  const masked = maskChatPII(userMessage);
  const intentResult = classifyIntent(masked);
  let responseMessage = '';
  const suggestedActions: string[] = [];
  let escalated = false;

  if (intentResult.intent === 'escalation') {
    responseMessage = '상담원에게 연결하겠습니다. 잠시만 기다려 주십시오.';
    escalated = true;
  } else {
    const faqMatch = FAQ_DATABASE.find(faq => masked.includes(faq.question.slice(0, 4)) || faq.question.includes(masked.slice(0, 6)));
    if (faqMatch) {
      responseMessage = faqMatch.answer;
      suggestedActions.push('관련 서비스 바로가기', '추가 문의하기');
    } else if (intentResult.intent === 'civil_complaint') {
      responseMessage = '민원을 접수하시겠습니까? 아래 양식을 작성해 주십시오.';
      suggestedActions.push('민원 접수', '처리 현황 조회');
    } else if (intentResult.intent === 'service_guide') {
      responseMessage = '해당 서비스에 대해 안내해 드리겠습니다.';
      suggestedActions.push('온라인 신청', '방문 예약');
    } else {
      responseMessage = '무엇을 도와드릴까요? 민원 접수, 서비스 안내, 정보 문의를 도와드립니다.';
      suggestedActions.push('민원 접수', '서비스 안내', '상담원 연결');
    }
  }

  recordAudit({ actor: 'system', tenantId, action: 'CHAT_RESPONSE_GENERATED', target: sessionId, details: { intent: intentResult.intent, confidence: intentResult.confidence, escalated } });

  return {
    responseId: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    message: responseMessage,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    suggestedActions,
    escalated,
    respondedAt: new Date().toISOString(),
  };
}

export class CitizenChatbotService {
  constructor(private readonly tenantId: string) {}
  classify(message: string): IntentResult { return classifyIntent(message); }
  respond(sessionId: string, message: string): ChatResponse { return generateResponse(this.tenantId, sessionId, message); }
  getAuditLog(): readonly ChatAuditEntry[] { return getChatAuditLog(this.tenantId); }
}
