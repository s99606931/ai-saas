# MTU-N223: Ingress/트래픽 라우팅 상세 모니터링 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 설계 방향

B안: Ingress 컨트롤러(Traefik) 메트릭 기반 Recording Rules + 5개 영역 대시보드

## 2. 상세 설계

### 2.1 대시보드 구조 (FR-N223.2)

```
Row 1: 트래픽 개요 (총 요청률 + 에러율 + P99 지연 + 가용성)
Row 2: 경로별 분석 (호스트별 트래픽 + 경로별 지연 + 상태코드 분포)
Row 3: TLS/보안 (인증서 만료 + TLS 버전 + 암호화 스위트)
Row 4: 에러 분석 (4xx/5xx 추이 + 에러 원인 + 재시도율)
Row 5: 업스트림 (백엔드 응답 시간 + 가용성 + 연결 풀)
```

### 2.2 알림 규칙 (FR-N223.3)

| 알림 | 조건 | 심각도 |
|------|------|--------|
| IngressLatencyHigh | P99 > 500ms | warning |
| IngressErrorRateHigh | 5xx > 5% | warning |
| IngressErrorRateCritical | 5xx > 20% | critical |
| IngressTLSCertExpiring | 만료 < 30일 | warning |
| IngressTLSCertExpiringSoon | 만료 < 7일 | critical |
| IngressUpstreamDown | 백엔드 가용성 < 90% | critical |
| IngressTrafficSpike | 트래픽 > 5x 평상시 | warning |

## 3. Design Anchor

- Plan: FR-N223.1~N223.3
- CSAP: D-09 암호화, D-08 접근통제
