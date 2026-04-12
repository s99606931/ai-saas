# SVC-AI-ADV-R111 — AI i18n Automation (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R111.plan.md

## 1. 아키텍처

```
extractKeys → findMissingTranslations → suggestTranslation → mergeTranslations
                        ↓
                   getAuditLog()
```

## 2. 타입 정의

```typescript
export type Locale = string  // 예: 'ko', 'en', 'ja'

export interface I18nKey {
  key: string
  namespace?: string
  occurrences: number
  sources: string[]  // 발견된 파일명
}

export interface Translation {
  key: string
  locale: Locale
  value: string
}

export interface TranslationMap {
  [locale: string]: {
    [key: string]: string
  }
}

export interface MissingTranslation {
  key: string
  missingLocales: Locale[]
  existingLocales: Locale[]
}

export interface TranslationSuggestion {
  key: string
  locale: Locale
  suggested: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  method: 'PASSTHROUGH' | 'KEY_TRANSFORM' | 'FALLBACK'
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}
```

## 3. 알고리즘

### §3.1 키 추출
- 기본 패턴: `t\(['"]([^'"]+)['"]\)` (react-i18next, vue-i18n 등)
- 커스텀 패턴 주입 가능
- 키 중복 시 occurrences 카운트 증가

### §3.2 누락 번역 탐지
- 기준 로케일(기본 'ko') 키 집합과 각 로케일 키 집합 diff
- 누락된 로케일 목록 반환

### §3.3 번역 제안 (규칙 기반)
- 동일 키 → 다른 로케일 복사 (PASSTHROUGH, HIGH)
- camelCase/snake_case 키 → 공백 치환 (KEY_TRANSFORM, MEDIUM)
- 제안 불가 → 키 자체 반환 (FALLBACK, LOW)

### §3.4 번역 병합
- base에 additions를 deep merge
- 충돌 시 additions 우선 (덮어쓰기)

## 4. Design Anchor

- CSAP D-06: 추출/병합 감사 로그
- N2SF: 번역 콘텐츠 외부 전송 없음 (규칙 기반)
