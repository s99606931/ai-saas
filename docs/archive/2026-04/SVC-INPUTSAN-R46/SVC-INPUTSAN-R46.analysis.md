# SVC-INPUTSAN-R46 Analysis

| 항목 | 값 |
|------|-----|
| MTU | SVC-INPUTSAN-R46 |
| 일자 | 2026-04-11 |
| matchRate | 100% |
| 테스트 | 45/45 |

## FR 매핑

| FR | 모듈 | 테스트 수 | 상태 |
|----|------|----------|------|
| FR-IS.1 escapeHtml | html.ts | 4 | ✅ |
| FR-IS.2 escapeAttribute | html.ts | 2 | ✅ |
| FR-IS.3 safeFilename | filename.ts | 7 | ✅ |
| FR-IS.4 containPath | path.ts | 5 | ✅ |
| FR-IS.5 isSafeUrl | url.ts | 7 | ✅ |
| FR-IS.6 stripControlChars | text.ts | 6 | ✅ |
| FR-IS.7 truncate | text.ts | 5 | ✅ |
| FR-IS.8 isPrivateIp | url.ts | 9 | ✅ |

## Q-Gate

G1(8/8) G2 G3 G4(45 tests, 8 모듈) G5(OWASP A03/A10 페이로드 차단) G6(D-12) G7 통과.

## OWASP 페이로드 검증

- A03 Injection: `<script>alert("x")</script>` → escape 변환 확인
- A03 Path Traversal: `../../etc/passwd` → 안전 파일명 변환, containPath false
- A10 SSRF: `http://127.0.0.1/`, `http://192.168.1.1/`, `file:///etc/passwd`, `javascript:` 모두 차단
