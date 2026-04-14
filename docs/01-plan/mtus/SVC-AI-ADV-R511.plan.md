# SVC-AI-ADV-R511 Plan — AI기반 서비스 자동 스케일링 정책 최적화

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 트래픽 패턴을 분석해 최적 오토스케일링 정책을 자동 도출하여 비용 절감 및 SLO 준수 |
| WHO | SRE, 인프라 운영팀 |
| RISK | 과도 스케일아웃으로 인한 비용 낭비, 과소 스케일로 인한 서비스 장애 방지 |
| SUCCESS | SC-R511-1: 메트릭 수집 / SC-R511-2: 정책 도출 / SC-R511-3: 권고 출력 |
| SCOPE | service-autoscaling-policy-optimizer.ts 구현 |

## 요구사항
- FR-R511.1: 메트릭 입력 (serviceId, cpuAvg, memAvg, rpsAvg, rpsP95, sloTarget 0~1)
- FR-R511.2: 스케일 판정 (rpsP95>rpsAvg*2||cpuAvg>75: SCALE_OUT, cpuAvg<30&&memAvg<30: SCALE_IN, else MAINTAIN)
- FR-R511.3: 최적 인스턴스 수 = ceil(rpsAvg / 100) + 버퍼 (SCALE_OUT:+2, SCALE_IN:-1, MAINTAIN:+0)
- FR-R511.4: SLO 위험도 (sloTarget<0.99&&action=SCALE_IN: HIGH_RISK, else LOW_RISK)
- FR-R511.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R511.* ↔ `service-autoscaling-policy-optimizer.ts` ↔ 테스트 ↔ CSAP D-06
