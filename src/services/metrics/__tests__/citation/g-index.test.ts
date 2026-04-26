import { calculateGIndex } from '../../citation/g-index';

describe('g-index calculations', () => {
  test('should calculate g-index correctly', () => {
    const citations = [10, 8, 5, 4, 3];
    expect(calculateGIndex(citations)).toBe(5);
  });

  test('should handle empty citations array', () => {
    expect(calculateGIndex([])).toBe(0);
  });

  test('should handle all zeros', () => {
    expect(calculateGIndex([0, 0, 0])).toBe(0);
  });

  test('should handle unsorted citations', () => {
    const citations = [3, 10, 4, 8, 5];
    expect(calculateGIndex(citations)).toBe(5);
  });

  test('should handle large citation counts', () => {
    const citations = [100, 90, 80, 70, 60];
    expect(calculateGIndex(citations)).toBe(5);
  });
});
