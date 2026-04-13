# SVC-AI-ADV-R398 Design: Translation Engine

## Glossary
- Map<ko, { en, ja, zh }>

## 번역
- tokens = text.split(/\s+/)
- mapped = tokens.map(t => glossary[t]?.[lang] ?? t)
- missing = tokens.filter(t => !glossary[t])
- coverage = (tokens.length - missing.length) / tokens.length

## 결과
- { translated, missingTerms, coverage, lang }
