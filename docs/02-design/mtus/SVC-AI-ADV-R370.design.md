# SVC-AI-ADV-R370 Design: 자동 데이터 품질 검증

## 필드 유형
- STRING | NUMBER | DATE | EMAIL | PHONE | BOOLEAN

## 검증 규칙
- required: 값 존재 여부
- type: 타입 매칭
- minLength / maxLength: 문자열
- pattern: regex

## 품질 상태
- PASSED: 모든 규칙 충족
- WARNING: 선택 규칙만 위반
- FAILED: 필수 규칙 위반

## 점수
- score = passedFields / totalFields * 100

## N2SF
- C/S 등급 차단 (validateRecord)
- 감사 로그: schema.register, record.validate
