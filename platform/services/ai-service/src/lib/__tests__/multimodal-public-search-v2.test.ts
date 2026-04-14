import { describe, it, expect, beforeEach } from 'vitest'
import { MultimodalPublicSearchV2 } from '../multimodal-public-search-v2'

describe('MultimodalPublicSearchV2', () => {
  let search: MultimodalPublicSearchV2

  beforeEach(() => { search = new MultimodalPublicSearchV2() })

  it('should register an index', () => {
    search.registerIndex('idx1', 'Law Docs', 'document')
    expect(search.getDocumentCount('idx1')).toBe(0)
  })

  it('should index a document', () => {
    search.registerIndex('idx1', 'Law', 'document')
    search.indexDocument('idx1', 'doc1', 'content', 0.9)
    expect(search.getDocumentCount('idx1')).toBe(1)
  })

  it('should return search results sorted by relevance', () => {
    search.registerIndex('idx1', 'Laws', 'text')
    search.indexDocument('idx1', 'doc1', 'content A', 0.5)
    search.indexDocument('idx1', 'doc2', 'content B', 0.9)
    const results = search.search('idx1', 2)
    expect(results[0]!.docId).toBe('doc2')
  })

  it('should limit search results', () => {
    search.registerIndex('idx1', 'Laws', 'text')
    search.indexDocument('idx1', 'doc1', 'a', 0.9)
    search.indexDocument('idx1', 'doc2', 'b', 0.8)
    search.indexDocument('idx1', 'doc3', 'c', 0.7)
    expect(search.search('idx1', 2)).toHaveLength(2)
  })

  it('should block C grade data', () => {
    search.registerIndex('idx1', 'X', 'text')
    expect(() => search.indexDocument('idx1', 'doc1', 'content', 0.8, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    search.registerIndex('idx1', 'X', 'text')
    expect(() => search.indexDocument('idx1', 'doc1', 'content', 0.8, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    search.registerIndex('idx1', 'Laws', 'document')
    search.indexDocument('idx1', 'doc1', 'text', 0.7)
    expect(search.getAuditLog().length).toBeGreaterThan(0)
  })
})
