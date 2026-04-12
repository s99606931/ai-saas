# SVC-INPUTSAN-R46 Plan — 입력 새니타이저 (XSS/Path/SSRF 방어)

| 항목 | 값 |
|------|-----|
| MTU | SVC-INPUTSAN-R46 |
| 대상 | `platform/packages/input-sanitizer` |
| 복잡도 | LOW-MED |
| 작성일 | 2026-04-11 |

---

## Executive Summary

| 관점 | 현황 | 목표 |
|------|------|------|
| 기능 | request-validator는 스키마만 검증, 콘텐츠 새니타이즈 부재 | HTML/Path/URL/Filename 새니타이저 통합 패키지 |
| 품질 | 각 서비스가 ad-hoc escape 함수 작성 | 공통 검증된 구현 + 20개 이상 테스트 |
| 보안 | XSS/Path Traversal/SSRF 위험 | OWASP A03(Injection) A10(SSRF) 차단 |
| 운영 | 보안 헬퍼 분산 | 단일 import (`@public-saas/input-sanitizer`) |

---

## Context Anchor

- **WHY**: 사용자 입력을 DB/HTML/파일경로/외부 URL에 사용하기 전 새니타이즈가 필수. 누락 시 XSS, Path Traversal, SSRF가 발생. 공공 SaaS는 개인정보 다루므로 OWASP Top10 통과 의무.
- **WHO**: 모든 마이크로서비스의 컨트롤러/핸들러.
- **RISK**: 과도한 새니타이즈로 정상 입력 손상. 특정 우회 패턴 누락.
- **SUCCESS**: HTML escape, path 정규화, URL 화이트리스트 검증, filename 안전화 함수 제공. 모두 순수 함수.
- **SCOPE**: HTML(escape), filename(safe), path(normalize+contain), URL(scheme/host 화이트리스트), control char 제거. DOMPurify급 트리 새니타이즈는 미포함 (별도 패키지).

---

## FR

| ID | 요구사항 | 수용 기준 |
|----|----------|----------|
| FR-IS.1 | `escapeHtml(s)`: HTML 메타문자 `& < > " ' /` 엔티티 변환 | XSS 페이로드 변환 검증 |
| FR-IS.2 | `escapeAttribute(s)`: HTML 속성용 escape (= 포함) | 속성 컨텍스트 안전 |
| FR-IS.3 | `safeFilename(s)`: 파일명에서 `../`, `/`, `\`, NUL, 제어문자 제거 | Path Traversal 페이로드 차단 |
| FR-IS.4 | `containPath(base, target)`: target이 base 하위인지 검증 | `../etc/passwd` 차단 |
| FR-IS.5 | `isSafeUrl(url, opts)`: scheme + host 화이트리스트 검증 | http/https 외 차단, 로컬IP 차단 옵션 |
| FR-IS.6 | `stripControlChars(s)`: U+0000~U+001F 제어문자 제거 (탭/개행 옵션) | 로그 인젝션 방지 |
| FR-IS.7 | `truncate(s, max)`: 안전 길이 제한 (멀티바이트 인지) | 한글 안전 |
| FR-IS.8 | `isPrivateIp(host)`: RFC1918 + loopback + link-local 탐지 | SSRF 차단 보조 |

---

## Q-Gate

- G1: 8/8 FR
- G2: Design 모듈 분리 + 알고리즘
- G3: typecheck strict
- G4: 20개 이상 테스트 통과
- G5: OWASP A03/A10 페이로드 차단 검증
- G6: CSAP D-12 시스템 개발 보안
- G7: audit.jsonl
