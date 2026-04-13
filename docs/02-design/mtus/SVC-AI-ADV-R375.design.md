# SVC-AI-ADV-R375 Design: 멀티테넌트 격리 검증 v2

## 격리 레벨
- STRICT: allowedResources 엄격 체크, 공유 리소스 금지
- STANDARD: 공유 리소스 READ만 허용
- RELAXED: 공유 리소스 READ/WRITE 허용, DELETE 금지

## 위반 심각도
- DELETE → CRITICAL
- WRITE → HIGH
- READ → MEDIUM

## 로그 분리
- violations: Map<tenantId, Violation[]>
- getViolations(tenantId) 별도 반환
