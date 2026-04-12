# Design — SVC-AI-ADV-R158 Content Policy Enforcer

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 규칙 기반 (RegExp) | 빠름, 예측 가능 | 정교성 낮음 | ★ Pragmatic Balance |
| LLM 분류기 | 정교함 | 비용/지연, 외부 의존 | - |
| 하이브리드 | 정밀 | 복잡도 증가 | - |

## 모듈 구조

```
content-policy-enforcer.ts
├── PolicyRule { id, category, pattern (string | RegExp), severity }
├── PolicyViolation { ruleId, category, severity, matched }
├── EnforceResult { allowed, violations[], language_issues[] }
├── ContentPolicyEnforcer
│   ├── constructor(rules?, opts?)
│   ├── enforce(text, grade)
│   ├── addRule(rule), removeRule(id)
│   ├── getAuditLog(), getStats()
│   └── (private) checkRule, checkLanguage, audit
```

## 핵심 결정

- 기본 정책 8 카테고리는 하드코딩 시드, 런타임 확장 가능
- 언어 표준 체크는 별도 검사 경로: 비속어/외래어 과다/줄임말 간이 휴리스틱
- severity 'critical' 1건 또는 'high' 2건 이상 시 allowed=false

## Session Guide

- 파일 크기 < 300 줄 목표
- 테스트 8개 이상, 커버리지 80%+

## 추적성

- FR-R158.1~FR-R158.8 → ContentPolicyEnforcer 메서드
