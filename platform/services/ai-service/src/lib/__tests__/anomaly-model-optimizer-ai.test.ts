import { describe, it, expect, beforeEach } from 'vitest'
import { AnomalyModelOptimizerAI } from '../anomaly-model-optimizer-ai'

describe('AnomalyModelOptimizerAI', () => {
  let ai: AnomalyModelOptimizerAI

  beforeEach(() => {
    ai = new AnomalyModelOptimizerAI()
    ai.registerModel('m1', '네트워크 이상탐지', 0.5, 0.85)
  })

  it('모델 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'model.register')).toBe(true)
  })

  it('F1 점수 계산 — 2*p*r/(p+r)', () => {
    ai.recordPerformance('m1', 0.5, 0.8, 0.6)
    // F1 = 2*0.8*0.6/(0.8+0.6) = 0.96/1.4 ≈ 0.6857
    const f1 = ai.getCurrentF1('m1')
    expect(f1).toBeCloseTo(0.6857, 2)
  })

  it('precision=0 또는 recall=0 이면 F1=0', () => {
    ai.recordPerformance('m1', 0.5, 0, 0.8)
    expect(ai.getCurrentF1('m1')).toBe(0)
    ai.recordPerformance('m1', 0.5, 0.8, 0)
    // 이제 currentThreshold=0.5의 최신 샘플 F1=0
    expect(ai.getCurrentF1('m1')).toBe(0)
  })

  it('최대 F1 임계값 추천', () => {
    ai.recordPerformance('m1', 0.4, 0.7, 0.6)
    ai.recordPerformance('m1', 0.5, 0.8, 0.8)
    ai.recordPerformance('m1', 0.6, 0.6, 0.9)
    const rec = ai.getOptimalThreshold('m1')
    // 0.5 → F1=2*0.8*0.8/(0.8+0.8)=0.8, 0.6 → F1=2*0.6*0.9/(0.6+0.9)=0.72
    expect(rec.recommendedThreshold).toBe(0.5)
    expect(rec.expectedF1).toBeCloseTo(0.8, 2)
  })

  it('데이터 없을 때 현재 임계값 유지', () => {
    const rec = ai.getOptimalThreshold('m1')
    expect(rec.recommendedThreshold).toBe(0.5)
    expect(rec.expectedF1).toBe(0)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordPerformance('m1', 0.5, 0.8, 0.6, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 차단', () => {
    expect(() => ai.recordPerformance('m1', 0.5, 0.8, 0.6, 'S')).toThrow('BLOCKED')
  })

  it('미등록 모델 에러', () => {
    expect(() => ai.getCurrentF1('unknown')).toThrow()
  })
})
