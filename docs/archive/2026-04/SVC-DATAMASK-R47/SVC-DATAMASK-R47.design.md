# SVC-DATAMASK-R47 Design — 데이터 마스킹 엔진

## 모듈 구조

```
platform/packages/data-mask/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts          # DataGrade 재export, 정책 타입
│   ├── pii-patterns.ts   # 6종 정규식 + Luhn
│   ├── string-masker.ts  # 문자열 마스킹 (regex 기반)
│   ├── tree-masker.ts    # 객체/배열 재귀 마스킹
│   ├── key-policy.ts     # 키 기반 마스킹 정책
│   └── enforcer.ts       # enforceGrade 가드
└── tests/
    └── data-mask.test.ts
```

## 알고리즘

### PII 패턴 (탐지 우선순위)

```
1. 주민등록번호: /\b\d{6}[- ]?[1-4]\d{6}\b/g
2. 신용카드:    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g (Luhn 검증)
3. 한국 휴대폰: /\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/g
4. 한국 유선:   /\b0[2-6]\d?[- ]?\d{3,4}[- ]?\d{4}\b/g
5. 이메일:      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
6. 계좌번호:    /\b\d{2,4}[- ]?\d{2,6}[- ]?\d{2,8}\b/g (10-16자리)
```

### 마스킹 규칙

- SSN: `123456-1******`
- 휴대폰: `010-****-5678`
- 이메일: `a***@example.com` (로컬파트 첫 글자 + ***)
- 카드: `1234-56**-****-3456`
- 계좌: `***-***-1234`
- 주소: 시·도 + 시·군·구만 보존, 나머지 → `****`

### enforceGrade
```
function enforceGrade(grade, allowed[]):
  if !allowed.includes(grade):
    throw DataGradeViolationError(grade, allowed)
```

### Tree 순회
```
maskTree(node, policy):
  if string: return maskString(node, policy)
  if array:  return node.map(child => maskTree(child, policy))
  if object: 
    for [k, v] in entries:
      if keyPolicy.shouldMask(k): result[k] = '[MASKED]'
      else: result[k] = maskTree(v, policy)
  else: return node
```

## 테스트 계획 (25+)

| # | 케이스 | FR |
|---|--------|----|
| 1-3 | SSN 정상 패턴 (3종 변형) | FR-DM.1 |
| 4 | SSN 잘못된 포맷 무시 | FR-DM.1 |
| 5-6 | 휴대폰 010/011 | FR-DM.2 |
| 7 | 유선 02 | FR-DM.2 |
| 8-9 | 이메일 짧은/긴 | FR-DM.3 |
| 10-11 | 카드 Luhn 통과/실패 | FR-DM.4 |
| 12 | 계좌 마스킹 | FR-DM.5 |
| 13-14 | 주소 마스킹 (서울/경기) | FR-DM.6 |
| 15-17 | 객체 1단/3단/5단 깊이 | FR-DM.7 |
| 18 | 배열 마스킹 | FR-DM.7 |
| 19-20 | 키 정책 password/ssn | FR-DM.8 |
| 21 | enforceGrade C 등급 차단 | FR-DM.9 |
| 22 | enforceGrade O 등급 통과 | FR-DM.9 |
| 23 | onMask 콜백 호출 횟수 | FR-DM.10 |
| 24 | false positive: 일반 한글 텍스트 | 정확도 |
| 25 | 복합 텍스트 (이메일+전화 동시) | 다중 |
| 26 | 빈 객체/null/undefined | 안전성 |
| 27 | 순환 참조 방지 | 안전성 |
