# SVC-AI-ADV-R51 — Long-Context Compressor

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | 100K+ 토큰 문서를 30K로 압축 → 비용 70% 절감 |
| 기술 | LLMLingua 스타일 토큰 단위 압축 + 의미 보존 |
| 보안 | 압축 전후 PII 보존, C/S 차단 |
| 규정 | CSAP D-12 |

## Context Anchor
- **WHY**: 공공기관 RFP/계약서 문서가 100K+ 토큰을 자주 초과. context window 한계로 분석 불가. 압축 필요.
- **WHO**: 문서 분석 AI 운영자, 계약서 검토 자동화
- **RISK**: 핵심 정보 손실 → 중요 토큰 보존 점수 사용
- **SUCCESS**: 압축비 3x+, ROUGE-L 0.85+
- **SCOPE**: 텍스트 토큰 압축, 청크 기반 압축, 중요도 점수

## FR
| FR | 산출물 |
|---|---|
| FR-R51.1 토큰 단위 압축 | `long-context-compressor.ts::compress` |
| FR-R51.2 청크 기반 압축 | `long-context-compressor.ts::compressChunks` |
| FR-R51.3 중요도 점수 (TF-IDF + position) | `long-context-compressor.ts::scoreTokens` |
| FR-R51.4 압축비 보장 (목표 ratio) | `long-context-compressor.ts::compressToRatio` |
| FR-R51.5 통계 (압축비, 보존율) | `long-context-compressor.ts::stats` |
| FR-R51.6 감사 로그 | `long-context-compressor.ts::audit` |

## NFR
- 압축 시간 < 1s/10K 토큰
- TS strict 통과

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R51.1~6 | long-context-compressor.ts | 단위 테스트 |

## 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
