
import { cn, formatCurrency, toDate, formatManualDate, parseManualDate, cleanForFirestore } from './utils';
import { Timestamp } from 'firebase/firestore';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', false, 'b', { c: true, d: false })).toBe('a b c');
  });
});

describe('formatCurrency', () => {
  it('should format a number as INR currency', () => {
    expect(formatCurrency(12345.67)).toBe('₹12,345.67');
  });
});

describe('toDate', () => {
  it('should handle Date objects', () => {
    const date = new Date();
    expect(toDate(date)).toEqual(date);
  });

  it('should handle Firestore Timestamps', () => {
    const date = new Date();
    const timestamp = Timestamp.fromDate(date);
    expect(toDate(timestamp)).toEqual(date);
  });

  it('should handle ISO date strings', () => {
    const date = new Date();
    expect(toDate(date.toISOString())).toEqual(date);
  });

  it('should handle manual date strings', () => {
    expect(toDate('25-12-2023')).toEqual(new Date(2023, 11, 25));
  });

  it('should handle numbers (Excel serial date)', () => {
    // Note: This is a simplified test. Excel date handling can be complex.
    // 45211 corresponds to 2023-10-23
    expect(toDate(45211)).toEqual(new Date(2023, 9, 23));
  });

  it('should return a new Date for null or undefined input', () => {
    expect(toDate(null)).toBeInstanceOf(Date);
    expect(toDate(undefined)).toBeInstanceOf(Date);
  });
});

describe('formatManualDate', () => {
  it('should format a Date object as DD-MM-YYYY', () => {
    const date = new Date(2023, 11, 25);
    expect(formatManualDate(date)).toBe('25-12-2023');
  });
});

describe('parseManualDate', () => {
  it('should parse a DD-MM-YYYY string into a Date object', () => {
    expect(parseManualDate('25-12-2023')).toEqual(new Date(2023, 11, 25));
  });

  it('should handle different separators', () => {
    expect(parseManualDate('25/12/2023')).toEqual(new Date(2023, 11, 25));
    expect(parseManualDate('25.12.2023')).toEqual(new Date(2023, 11, 25));
  });

  it('should handle two-digit years', () => {
    expect(parseManualDate('25-12-23')).toEqual(new Date(2023, 11, 25));
    expect(parseManualDate('25-12-99')).toEqual(new Date(1999, 11, 25));
  });

  it('should return null for invalid date strings', () => {
    expect(parseManualDate('invalid-date')).toBeNull();
  });
});

describe('cleanForFirestore', () => {
  it('should convert Date objects to Firestore Timestamps', () => {
    const date = new Date();
    const cleaned = cleanForFirestore({ date });
    expect(cleaned.date).toBeInstanceOf(Timestamp);
    expect(cleaned.date.toDate()).toEqual(date);
  });

  it('should handle nested objects and arrays', () => {
    const date = new Date();
    const data = {
      a: 1,
      b: {
        c: date,
      },
      d: [1, { e: date }],
    };
    const cleaned = cleanForFirestore(data);
    expect(cleaned.b.c).toBeInstanceOf(Timestamp);
    expect(cleaned.d[1].e).toBeInstanceOf(Timestamp);
  });

  it('should remove undefined values', () => {
    const data = {
      a: 1,
      b: undefined,
    };
    const cleaned = cleanForFirestore(data);
    expect(cleaned).toEqual({ a: 1 });
  });
});
