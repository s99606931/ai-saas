# SVC-AI-ADV-R65 — 설계

## 모듈
- incident-playbook.ts: Playbook 정의(YAML-like) + 단계별 실행 상태 머신
- crisis-response-engine.ts: 시그널 매칭 → 플레이북 선택 → 실행 오케스트레이션

## Playbook 구조
```typescript
interface Playbook {
  id: string
  name: string
  triggers: PlaybookTrigger[]   // 시그널 매칭 조건
  severity: 'low'|'medium'|'high'|'critical'
  steps: PlaybookStep[]
  requiredRole: string          // D-08 RBAC
  autoExecuteUpTo?: number      // 자동 실행 허용 단계 번호
}

interface PlaybookStep {
  id: string
  name: string
  action: 'notify'|'isolate'|'scale'|'rollback'|'snapshot'|'runbook'|'manual'
  params: Record<string, unknown>
  requiresApproval: boolean
  timeoutMs: number
  rollbackOnFailure?: boolean
}
```

## 시그널 매칭
- 시그널: {type, severity, source, tags, metrics}
- 트리거 조건: 시그널 type 매칭 + tag 교집합 + severity 임계
- 점수 기반 top-1 플레이북 선택

## 실행 흐름
```
signal 수신
→ match(signal, playbooks) → best playbook
→ actor RBAC 검증
→ step 1..N 순차 실행
  → step.requiresApproval && idx > autoExecuteUpTo
    → 승인 대기 큐에 투입
  → 실행 성공/실패 감사 기록
→ 완료 또는 롤백
```

## 제공 기본 플레이북 (10개)
1. critical-auth-failure-spike: 인증 실패 급증 → IP 차단 + SOC 알림
2. database-outage: DB 장애 → 읽기 전용 모드 + 백업 복원
3. high-error-rate: 에러율 급증 → 카나리 롤백 + 캐시 워밍
4. ssrf-attempt: SSRF 탐지 → 방화벽 규칙 업데이트 + 세션 무효화
5. data-exfil-suspect: 대용량 다운로드 탐지 → 토큰 무효화 + DLP 알림
6. cert-expiry: 인증서 만료 임박 → 자동 갱신 + 재배포
7. resource-saturation: 리소스 포화 → 오토스케일 + 캐시 확장
8. ransomware-suspect: 의심 파일 변경 → 스냅샷 + 격리
9. config-drift-critical: 설정 드리프트 → 롤백 + GitOps 재동기화
10. ddos-volumetric: DDoS 탐지 → CDN 실드 + rate limit 강화

## 보안
- autoExecuteUpTo 기본값 0 (수동 승인 필수)
- 모든 step 실행은 audit.jsonl에 기록
- requiredRole 미충족 시 즉시 거부 + 감사
