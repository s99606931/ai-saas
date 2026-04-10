# MTU-N226: Cert-Manager 인증서 수명주기 상세 모니터링 -- 설계 문서

## 1. 설계 방향

B안: cert-manager 메트릭 + Recording Rules + 4개 영역 대시보드

## 2. 대시보드 구조

```
Row 1: 인증서 개요 (총 수, Ready/NotReady, 만료 임박 수)
Row 2: 만료 타임라인 (만료일 기준 정렬 테이블 + 만료 히스토그램)
Row 3: 갱신/발급 (갱신 성공률 + 발급 지연 P99 + 실패 이력)
Row 4: ACME/Issuer (Issuer 상태 + ACME 챌린지 + Order 상태)
```

## 3. Design Anchor

- Plan: FR-N226.1~N226.3
- CSAP: D-09 암호화
