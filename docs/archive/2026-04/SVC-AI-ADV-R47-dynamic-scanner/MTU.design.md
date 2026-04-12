# SVC-AI-ADV-R47 — 설계

## 탐지 대상
- SQL 주입 시도 (OR 1=1, UNION SELECT, 주석 삽입)
- XSS 페이로드 (<script>, onerror, javascript:)
- Path Traversal (../, ..\\, %2e%2e)
- SSRF (http://169.254..., file://)
- Command Injection (; ls, && cat, | nc)
- NoSQL Injection ($where, $ne)
- 인증 우회 시도 (연속 401/403)
- Rate limit 우회 시도 (다수 IP)
- JWT 조작 (alg:none)

## 모듈
- api-vulnerability-detector.ts: 단일 요청 패턴 매칭 + 점수
- dynamic-security-scanner.ts: 스트림 모니터링 + 알림 + 감사

## 흐름
```
API 요청 로그 → 패턴 매칭 → 취약점 후보 → 심각도 점수 → 임계치 초과 → 알림 + audit.jsonl
```
