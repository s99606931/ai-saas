# SVC-AI-ADV-R69 — Multi-Modal RAG

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 공공기관 문서/도면/사진 복합 검색 | 지원 모달 3종 |
| 기술 | 이미지+텍스트 임베딩 추상화 + 퓨전 랭킹 | p95 < 2s |
| 보안 | 이미지 EXIF/메타 등급 검사 | N2SF N-05 |
| 규정 | 이미지 출처 감사 | 100% |

## Context Anchor
- **WHY**: 공공기관 업무에는 설계도, 민원 사진, 계약서 스캔 등 비텍스트 자료가 많음. 텍스트 전용 RAG로는 불충분.
- **WHO**: 행정 담당자, 도면 검토자, 감리
- **RISK**: EXIF GPS 등 민감정보 유출, 퓨전 랭킹 편향
- **SUCCESS**: 텍스트/이미지/OCR 세 모달 인덱싱 + 퓨전 top-k
- **SCOPE**: IN — 모달별 임베딩 훅, 인덱스, 퓨전 랭킹, EXIF guard / OUT — 비전 모델 학습

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R69.1 | 멀티모달 문서 등록 (text/image/ocr) + EXIF 검사 | multimodal-rag.ts |
| FR-R69.2 | 모달별 임베딩 훅 + 인덱스 | multimodal-rag.ts |
| FR-R69.3 | 퓨전 랭킹 (가중합 + RRF) | multimodal-rag.ts |
| FR-R69.4 | 등급/출처/EXIF 감사 | multimodal-rag.ts |
| FR-R69.5 | getAuditLog | multimodal-rag.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R69.1 | multimodal-rag.ts | multimodal-rag.test.ts | D-12 / N-05 |
| FR-R69.2 | multimodal-rag.ts | multimodal-rag.test.ts | - |
| FR-R69.3 | multimodal-rag.ts | multimodal-rag.test.ts | - |
| FR-R69.4 | multimodal-rag.ts | multimodal-rag.test.ts | D-06 |
| FR-R69.5 | multimodal-rag.ts | multimodal-rag.test.ts | D-06 |
