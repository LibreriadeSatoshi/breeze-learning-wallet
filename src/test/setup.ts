import '@testing-library/jest-dom/vitest';

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});