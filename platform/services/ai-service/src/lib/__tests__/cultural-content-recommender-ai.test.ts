// Plan SC: SVC-AI-ADV-R639
import { describe, it, expect, beforeEach } from 'vitest'
import { CulturalContentRecommenderAI } from '../cultural-content-recommender-ai'

describe('CulturalContentRecommenderAI', () => {
  let ai: CulturalContentRecommenderAI

  beforeEach(() => {
    ai = new CulturalContentRecommenderAI()
    ai.addContent({
      contentId: 'm1',
      title: '국립박물관 특별전',
      category: 'exhibition',
      tags: ['역사', '문화재'],
      rating: 4.5,
      region: 'seoul',
    })
    ai.addContent({
      contentId: 'm2',
      title: '재즈페스티벌',
      category: 'festival',
      tags: ['음악', '재즈'],
      rating: 4.0,
      region: 'busan',
    })
  })

  it('addContent — 감사 로그 기록', () => {
    expect(ai.getAuditLog().length).toBeGreaterThan(0)
  })

  it('recommend — 카테고리 선호 반영', () => {
    const r = ai.recommend({
      userId: 'u1',
      favoriteCategories: ['exhibition'],
      favoriteTags: ['역사'],
      homeRegion: 'seoul',
      viewedContentIds: [],
    })
    expect(r[0]!.contentId).toBe('m1')
  })

  it('recommend — 본 콘텐츠 제외', () => {
    const r = ai.recommend({
      userId: 'u2',
      favoriteCategories: ['exhibition'],
      favoriteTags: [],
      homeRegion: 'seoul',
      viewedContentIds: ['m1'],
    })
    expect(r.find((x) => x.contentId === 'm1')).toBeUndefined()
  })

  it('recommend — 태그 매칭 점수 반영', () => {
    const r = ai.recommend({
      userId: 'u3',
      favoriteCategories: ['festival'],
      favoriteTags: ['재즈'],
      homeRegion: 'busan',
      viewedContentIds: [],
    })
    const m2 = r.find((x) => x.contentId === 'm2')!
    expect(m2.matchedTags).toContain('재즈')
  })

  it('recommend — topK 제한 준수', () => {
    for (let i = 3; i < 10; i++) {
      ai.addContent({
        contentId: `m${i}`,
        title: `content ${i}`,
        category: 'movie',
        tags: ['drama'],
        rating: 4,
        region: 'seoul',
      })
    }
    const r = ai.recommend(
      {
        userId: 'u4',
        favoriteCategories: ['movie'],
        favoriteTags: ['drama'],
        homeRegion: 'seoul',
        viewedContentIds: [],
      },
      3,
    )
    expect(r.length).toBeLessThanOrEqual(3)
  })

  it('recommend — C등급 차단', () => {
    expect(() =>
      ai.recommend(
        {
          userId: 'u5',
          favoriteCategories: ['movie'],
          favoriteTags: [],
          homeRegion: 'seoul',
          viewedContentIds: [],
        },
        5,
        'C',
      ),
    ).toThrow('BLOCKED')
  })
})
