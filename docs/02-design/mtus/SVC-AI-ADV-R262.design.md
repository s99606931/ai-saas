# SVC-AI-ADV-R262 Design — 레거시 문법 변환기

> 작성일: 2026-04-13 | 버전: 1.0.0

## Design Anchor
- Plan: SVC-AI-ADV-R262.plan.md
- Impl: `legacy-syntax-transformer.ts`

## 파이프라인

```
validate(source) → detectSecrets() → applyRules(lang) → collectChanges → return
```

## 규칙 테이블

```typescript
type RuleFn = (src: string) => { text: string, changes: string[], warnings: string[] }
```

- Python2To3Rules: print 문, xrange, raw_input, iteritems, has_key
- Java8To17Rules: 다이아몬드 연산자, com.sun 경고, var 권고

## 시크릿 탐지

```
/api[_-]?key\s*=\s*["'][^"']+["']/i
/password\s*=\s*["'][^"']+["']/i
/BEGIN (RSA |)PRIVATE KEY/
```

탐지 시 throw BLOCKED.

## 통계

Map<Language, count> 유지
