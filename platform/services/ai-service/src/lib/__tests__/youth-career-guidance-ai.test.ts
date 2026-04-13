// Plan SC: SVC-AI-ADV-R638
import { describe, it, expect, beforeEach } from 'vitest'
import { YouthCareerGuidanceAI } from '../youth-career-guidance-ai'

describe('YouthCareerGuidanceAI', () => {
  let ai: YouthCareerGuidanceAI

  beforeEach(() => {
    ai = new YouthCareerGuidanceAI()
    ai.registerCareer({
      careerId: 'c1',
      name: '소프트웨어 개발자',
      requiredEducation: 'bachelor',
      interests: ['tech', 'science'],
      aptitudeSkills: ['programming', 'math'],
      growthOutlook: 80,
    })
  })

  it('registerCareer — 감사 로그 기록', () => {
    expect(ai.getAuditLog()[0]!.action).toBe('career.register')
  })

  it('recommend — 학력 부족 시 제외', () => {
    const r = ai.recommend({
      profileId: 'y1',
      age: 18,
      currentEducation: 'highschool',
      interests: ['tech'],
      skills: ['programming'],
    })
    expect(r.recommendations).toHaveLength(0)
  })

  it('recommend — 흥미 일치 시 추천', () => {
    const r = ai.recommend({
      profileId: 'y2',
      age: 22,
      currentEducation: 'bachelor',
      interests: ['tech', 'science'],
      skills: ['programming', 'math'],
    })
    expect(r.recommendations).toHaveLength(1)
    expect(r.recommendations[0]!.score).toBeGreaterThan(0)
  })

  it('recommend — 무관한 흥미 시 추천 없음', () => {
    const r = ai.recommend({
      profileId: 'y3',
      age: 22,
      currentEducation: 'bachelor',
      interests: ['art'],
      skills: ['painting'],
    })
    expect(r.recommendations).toHaveLength(0)
  })

  it('recommend — 성장전망 반영', () => {
    ai.registerCareer({
      careerId: 'c2',
      name: '데이터 분석가',
      requiredEducation: 'bachelor',
      interests: ['tech'],
      aptitudeSkills: ['programming'],
      growthOutlook: 50,
    })
    const r = ai.recommend({
      profileId: 'y4',
      age: 24,
      currentEducation: 'bachelor',
      interests: ['tech'],
      skills: ['programming'],
    })
    const c2 = r.recommendations.find((x) => x.careerId === 'c2')!
    expect(c2.score).toBeGreaterThan(0)
  })

  it('recommend — S등급 차단', () => {
    expect(() =>
      ai.recommend(
        {
          profileId: 'y5',
          age: 22,
          currentEducation: 'bachelor',
          interests: ['tech'],
          skills: ['programming'],
        },
        'S',
      ),
    ).toThrow('BLOCKED')
  })
})
