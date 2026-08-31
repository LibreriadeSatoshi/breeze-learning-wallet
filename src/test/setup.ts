import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { useWalletStore } from '@/store/wallet-store';
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();

  useWalletStore.getState().showBalance = true;
});
