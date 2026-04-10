# MTU-N153 개인정보보호법 준수 자동 검증 — Design

> **문서 버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: CTO Lead

## 아키텍처: PII Scanner + Policy Engine + Automation

### 2.1 PII 탐지 스캐너

```typescript
// src/privacy/pii-scanner.ts
// Design Ref: §2.1 | Plan SC: FR-N153.1
const PII_PATTERNS = {
  residentNumber: /\d{6}-[1-4]\d{6}/g,                    // 주민등록번호
  phoneNumber: /01[016789]-?\d{3,4}-?\d{4}/g,             // 휴대전화
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  creditCard: /\d{4}-?\d{4}-?\d{4}-?\d{4}/g,             // 신용카드
  passport: /[A-Z]{1,2}\d{7,8}/g,                         // 여권번호
  driverLicense: /\d{2}-\d{6}-\d{2}/g,                   // 운전면허
  foreignerId: /\d{6}-[5-8]\d{6}/g,                       // 외국인등록번호
  bankAccount: /\d{3,4}-\d{2,6}-\d{2,6}-?\d{0,3}/g,     // 계좌번호
};

interface PIIScanResult {
  file: string;
  line: number;
  type: string;
  masked: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}
```

### 2.2 보존기간 자동 점검

```yaml
# infra/privacy-compliance/retention-checker.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: privacy-retention-checker
spec:
  schedule: "0 2 * * *"  # 매일 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: checker
              command: ["node", "/app/check-retention.js"]
```

### 2.3 PIA 자동 체크리스트

```yaml
# .gitea/workflows/privacy-pia-check.yaml
name: PIA Check
on:
  pull_request:
    paths: ['src/**']
jobs:
  pia-check:
    steps:
      - name: PII 패턴 스캔
      - name: 동의 처리 확인
      - name: 보존기간 설정 확인
```

### 2.4 보안 설계

| 통제 항목 | 구현 방법 |
|-----------|---------|
| 개인정보보호법 15조 | 동의 관리 API + 검증 미들웨어 |
| 개인정보보호법 21조 | 보존기간 자동 점검 + 파기 자동화 |
| 안전성 확보조치 4조 | PII 암호화 (AES-256) |
| CSAP D-13 | 공공기관 추가 개인정보 보호조치 |
| N2SF N-05 | 데이터 분류 + AI 전송 차단 |
