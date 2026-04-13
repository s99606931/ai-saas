# SVC-AI-ADV-R371 Design: 코드 취약점 패턴 분석

## 패턴
- SQL_INJECTION: /\$\{.*\}.*(SELECT|INSERT|UPDATE|DELETE)/i
- XSS: /innerHTML\s*=|document\.write/
- HARDCODED_SECRET: /(api[_-]?key|secret|password)\s*=\s*['"][^'"]+['"]/i
- INSECURE_CRYPTO: /md5|sha1|des\b/i
- PATH_TRAVERSAL: /\.\.\//
- COMMAND_INJECTION: /exec\(|child_process/
- SENSITIVE_LOG: /console\.log.*(password|token|secret)/i

## 심각도 가중치
- CRITICAL: 50, HIGH: 30, MEDIUM: 15, LOW: 5, INFO: 1

## 통과 조건
- CRITICAL === 0 && riskScore < 30
