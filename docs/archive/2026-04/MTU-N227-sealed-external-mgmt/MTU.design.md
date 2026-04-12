# MTU-N227: Sealed Secrets + External Secrets 운영 모니터링 -- 설계 문서

## 1. 설계 방향

B안: SealedSecrets + ExternalSecrets Operator 메트릭 기반 4개 영역 대시보드

## 2. 대시보드 구조

```
Row 1: 개요 (전체 시크릿 수, 동기화 상태, 건강도)
Row 2: ExternalSecrets (동기화 성공률, 지연, 실패 목록)
Row 3: SealedSecrets (복호화 상태, 실패, 키 상태)
Row 4: 키 관리 (키 회전 상태, 만료 임박 키, 사용 이력)
```

## 3. Design Anchor

- Plan: FR-N227.1~N227.3
- CSAP: D-09 암호화, D-08 접근통제
