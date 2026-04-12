# SVC-AI-ADV-R28: AI Compliance Checker DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

규제 체크리스트 + 자동 증거 수집 + 보고서 생성

---

## §1 규제 체크리스트 (FR-ADV28.1)

CSAP AI 항목: D-12 AI 보안 개발, D-06 AI 감사, D-08 AI 접근 통제
행안부 AI 윤리: 투명성, 공정성, 안전성, 책임성, 프라이버시
각 항목: id, category, requirement, severity, evidenceType

## §2 자동 검증 (FR-ADV28.2)

증거 유형별 검증기:
- code_pattern: 소스코드 패턴 검색 (감사 로그, PII 마스킹)
- config: 설정 파일 키 존재 여부 (암호화 설정)
- log: 감사 로그 존재/완전성 검증
- documentation: 문서 존재/필수 섹션 검증

## §3 준수 보고서 (FR-ADV28.3)

보고서 구조:
- 전체 준수율 (%) 
- 항목별 상태: compliant / non_compliant / not_applicable
- 증거 링크 (파일 경로 + 줄 번호)
- 생성 일시 + 검증 도구 버전

## §4 위험 등급 (FR-ADV28.4)

분류 기준:
- 고위험: PII 처리, 의사결정 자동화
- 중위험: 정보 검색, 문서 생성
- 저위험: 번역, 요약, FAQ

## §5 개선 권고 (FR-ADV28.5)

미준수 항목별 구체적 코드 예시 + 구현 가이드 제공
