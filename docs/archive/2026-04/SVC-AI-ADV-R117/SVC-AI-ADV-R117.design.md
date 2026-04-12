# SVC-AI-ADV-R117 — Cross-Lingual AI Bridge Design

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R117.plan.md

## 아키텍처

```
translate(text, targetLang)
  → detectLang(char ranges)
  → PII mask
  → grade guard (C/S block)
  → external translator(mock injectable)
  → glossary post-process (replaceAll public terms)
  → dual-text output + confidence
  → audit
```

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }
export type Lang = 'ko' | 'en' | 'zh' | 'ja'

export interface GlossaryEntry {
  ko: string
  en?: string
  zh?: string
  ja?: string
}

export interface TranslateRequest {
  text: string
  targetLang: Lang
  grade: DataGrade
  dualText?: boolean
}

export interface TranslateResult {
  sourceLang: Lang
  targetLang: Lang
  text: string
  original?: string  // dual-text 옵션 시
  confidence: number  // 0~1
  glossaryApplied: number
}

export interface BridgeOptions {
  glossary?: GlossaryEntry[]
  translator?: (text: string, to: Lang) => Promise<{ text: string; confidence: number }>
}
```

## 언어 감지

- 한글(AC00-D7AF) 비율 > 10% → ko
- 일본어 히라가나/카타카나(3040-30FF) → ja
- 한자(4E00-9FFF) + 한글 없음 → zh
- 기본 → en

## 용어 사전

- 기본 세트: "행정안전부/Ministry of the Interior and Safety", "개인정보보호법/PIPA", "정부24" 등 20+ 항목
- 주입 가능

## 보안

- C/S 차단
- PII 마스킹 후 외부 호출
- audit

## Session Guide

1. 타입 + 기본 용어 사전
2. detectLang 구현
3. PII mask + guard
4. translator 호출 + glossary post
5. confidence + audit + 10 test
