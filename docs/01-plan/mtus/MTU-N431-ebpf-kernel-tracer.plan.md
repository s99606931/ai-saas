# MTU-N431: eBPF 커널 레벨 추적

## WHY
- 애플리케이션 레벨 APM만으로는 커널 시스템콜/네트워크 병목 추적 불가
- 공공 클라우드 규제 대응: 시스템콜 레벨 감사 증적 필요 (CSAP D-06)

## FR
- FR-N431.1 시스템콜 이벤트 수집 (write/read/connect/accept)
- FR-N431.2 시스템콜 → 서비스 매핑 (PID → 컨테이너 → 서비스)
- FR-N431.3 이상 시스템콜 패턴 탐지 (비정상 파일 접근, 권한 상승)
- FR-N431.4 추적 결과 OpenTelemetry Span 변환
- FR-N431.5 감사 로그 기록 (CSAP D-06)

## Success Criteria
- 시스템콜 수집률 99%+
- 서비스 매핑 정확도 95%+
- 이상 탐지 F1 >= 0.8
