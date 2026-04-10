# Runbook 01: Pod CrashLoopBackOff 대응

> **트리거 알림**: KubePodCrashLooping
> **자동화 수준**: 자동
> **CSAP 매핑**: D-06 (침해사고 관리)

---

## 1. 영향도 평가

- **심각도**: 알림 라벨의 severity 확인
- **영향 범위**: 네임스페이스/서비스 확인
- **긴급도**: SLA 위반 여부 확인

## 2. 즉시 대응 절차

### 자동 대응 스크립트
```bash
bash scripts/runbook-automation/runbook-01.sh
```

### 수동 확인 명령
```bash
# 상태 확인
kubectl get pods -n $NAMESPACE -l app=$SERVICE
kubectl describe pod -n $NAMESPACE $POD_NAME
kubectl logs -n $NAMESPACE $POD_NAME --tail=100

# 이벤트 확인
kubectl get events -n $NAMESPACE --sort-by=.lastTimestamp | tail -20
```

## 3. 근본 원인 분석

- Grafana 대시보드 확인: 황금 신호 대시보드
- Loki 로그 분석: `{namespace="$NAMESPACE"} |= "error"`
- Tempo 트레이스 분석: 지연 원인 추적

## 4. 사후 처리

- [ ] 감사 로그 기록 (audit.jsonl)
- [ ] 사고 보고서 작성 (CSAP D-06 요건)
- [ ] 재발 방지 대책 수립
- [ ] Runbook 업데이트 (필요 시)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
