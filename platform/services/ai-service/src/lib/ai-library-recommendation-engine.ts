// Design Ref: §AI 도서관 추천 엔진 — 협업·내용 혼합 스코어링
// Plan SC: FR-R575.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface Book {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  available: boolean;
  popularity: number;
}

export interface ReaderProfile {
  readerId: string;
  preferredCategories: string[];
  readBookIds: string[];
  ratings: Record<string, number>; // bookId -> 1~5
}

export interface Recommendation {
  bookId: string;
  title: string;
  score: number;
  reasons: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AILibraryRecommendationEngine {
  private books = new Map<string, Book>();
  private readers = new Map<string, ReaderProfile>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R575.1
  addBook(book: Book, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (book.popularity < 0) throw new Error('인기도는 0 이상이어야 합니다');
    this.books.set(book.bookId, { ...book });
    this.append('ADD_BOOK', { bookId: book.bookId });
  }

  // Plan SC: FR-R575.2
  registerReader(reader: ReaderProfile, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.readers.set(reader.readerId, {
      ...reader,
      readBookIds: [...reader.readBookIds],
      preferredCategories: [...reader.preferredCategories],
      ratings: { ...reader.ratings },
    });
    this.append('REGISTER_READER', { readerId: reader.readerId });
  }

  // Plan SC: FR-R575.3
  recommend(readerId: string, topK = 5, grade: DataGrade = 'O'): Recommendation[] {
    blockClassifiedData(grade);
    const reader = this.readers.get(readerId);
    if (!reader) throw new Error(`이용자 미등록: ${readerId}`);

    const readSet = new Set(reader.readBookIds);
    const prefSet = new Set(reader.preferredCategories);
    const results: Recommendation[] = [];

    for (const book of this.books.values()) {
      if (!book.available) continue;
      if (readSet.has(book.bookId)) continue;

      let score = 0;
      const reasons: string[] = [];

      const overlap = book.categories.filter(c => prefSet.has(c)).length;
      if (overlap > 0) {
        score += overlap * 20;
        reasons.push(`선호 분야 ${overlap}개 일치`);
      }

      if (book.popularity >= 80) {
        score += 15;
        reasons.push('인기 도서');
      } else if (book.popularity >= 50) {
        score += 8;
      }

      // 같은 저자의 평점 반영
      for (const [ratedId, rating] of Object.entries(reader.ratings)) {
        const rated = this.books.get(ratedId);
        if (rated && rated.author === book.author && rating >= 4) {
          score += 10;
          reasons.push(`선호 저자(${book.author})`);
          break;
        }
      }

      if (score > 0) {
        results.push({ bookId: book.bookId, title: book.title, score, reasons });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, topK);
    this.append('RECOMMEND', { readerId, count: top.length });
    return top;
  }

  // Plan SC: FR-R575.4
  rateBook(readerId: string, bookId: string, rating: number): void {
    const reader = this.readers.get(readerId);
    if (!reader) throw new Error(`이용자 미등록: ${readerId}`);
    if (!this.books.has(bookId)) throw new Error(`도서 미등록: ${bookId}`);
    if (rating < 1 || rating > 5) throw new Error('평점은 1~5 범위여야 합니다');
    reader.ratings[bookId] = rating;
    if (!reader.readBookIds.includes(bookId)) reader.readBookIds.push(bookId);
    this.append('RATE_BOOK', { readerId, bookId, rating });
  }

  // Plan SC: FR-R575.5
  getMostPopular(topK = 5): Book[] {
    return Array.from(this.books.values())
      .filter(b => b.available)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, topK)
      .map(b => ({ ...b, categories: [...b.categories] }));
  }

  // Plan SC: FR-R575.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
