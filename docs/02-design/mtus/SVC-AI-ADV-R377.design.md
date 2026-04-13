# SVC-AI-ADV-R377 Design: AI기반 자동 보안 패치 관리

## 핵심 알고리즘

### 심각도 우선순위
- SEVERITY_PRIORITY: { critical: 4, high: 3, medium: 2, low: 1 }
- 미패치(pending) CVE를 심각도 내림차순 정렬

### 패치 상태
- 상태: 'pending' | 'applied' | 'skipped'
- getPendingCritical(): severity='critical' AND status='pending' 항목

## 클래스 설계

```typescript
class SecurityPatchManagerAI {
  registerCve(id, severity, affectedComponent): void
  updatePatchStatus(cveId, status, grade): void
  getPriorityList(): CveEntry[]
  getPendingCritical(): CveEntry[]
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: updatePatchStatus 차단
- 감사 로그: cve.register, patch.update
