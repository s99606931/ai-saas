# SVC-AI-ADV-R97 — Chatbot Persona Manager Design

## 인터페이스

```typescript
export type Tone = 'FORMAL' | 'FRIENDLY' | 'CONCISE' | 'EMPATHETIC';

export interface Persona {
  id: string;
  name: string;
  department: string;
  tone: Tone;
  glossary: Record<string, string>; // 용어 → 표준 표현
  bannedWords: string[];
  systemInstruction: string;
  version: number;
  updatedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  suggestions: Record<string, string>;
}

export class ChatbotPersonaManager {
  register(persona: Omit<Persona, 'version' | 'updatedAt'>): Persona;
  update(id: string, patch: Partial<Persona>): Persona;
  get(id: string): Persona;
  buildSystemPrompt(id: string, userContext?: string): string;
  validateResponse(id: string, text: string): ValidationResult;
}
```

## 공공기관 표준 글로서리 (내장)

- '고객님' → '민원인/이용자'
- '저희 회사' → '저희 기관'
- '구매' → '신청'
- 욕설/비속어 → banned 기본 포함

## 테스트

1. register + get
2. update → version++
3. buildSystemPrompt 생성
4. banned word 탐지
5. glossary 치환 제안
