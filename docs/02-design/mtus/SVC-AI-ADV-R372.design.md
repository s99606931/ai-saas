# SVC-AI-ADV-R372 Design: 배포 전략 최적화

## 전략 분기
1. changeType === 'HOTFIX' && env === 'PRODUCTION' → BLUE_GREEN
2. changeType === 'SCHEMA_MIGRATION' → RECREATE
3. risk ∈ {HIGH, CRITICAL} → CANARY
4. default → ROLLING

## 승인
- approvalRequired = (risk === 'HIGH' || risk === 'CRITICAL')

## 입력
- { changeType, environment, risk }
