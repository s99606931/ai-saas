# MTU-N228: Round 23 통합 점검 -- 설계 문서

## 설계: 3개 카테고리 종합 대시보드

```
Row 1: 종합 건강도 (인프라 + 데이터 + 보안 종합)
Row 2: 인프라 (API인증 + Flux + etcd + Ingress + Round22통합)
Row 3: 데이터 (PostgreSQL + Redis + Harbor)
Row 4: 보안 (CertManager + Secrets)
```

각 영역에서 해당 MTU 대시보드로 드릴다운

## Design Anchor

- Plan: FR-N228.1~N228.2
