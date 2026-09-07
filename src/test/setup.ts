import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { useWalletStore } from '@/store/wallet-store';
import { resetLightningAddress } from './breez/breez-service-mock';
import { createMockWindow, windowDefineProperty } from './window';
import { MockInstance } from 'vitest';

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

windowDefineProperty();

beforeEach(() => {    
  resetLightningAddress();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();

  useWalletStore.getState().showBalance = true;
});

const spyWindowOpen: MockInstance<typeof window.open> = vi.spyOn(window, "open");
  
spyWindowOpen.mockImplementation(() => {
  return createMockWindow() as Window; 
});

vi.mock("@/lib/lightning/breez-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lightning/breez-service")>();
  const mocks = await import("./breez/breez-service-mock");
  return {
    ...actual,
  getContactList: vi.fn(mocks.mockGetContactList),
  addContact: vi.fn().mockImplementation(mocks.mockAddContact),
  updateContact: vi.fn().mockImplementation(mocks.mockUpdateContact),
  deleteContact: vi.fn().mockImplementation(mocks.mockDeleteContact),
  buyBitcoin: vi.fn().mockResolvedValue({
    url: "https://cash.app/launch/pay/mocked-id",
  }),
  onSdkEvent: vi.fn(),
  listFiatRates: vi.fn().mockImplementation(mocks.mockListFiatRates),
  getLightningAddress: vi.fn().mockResolvedValue(mocks.mockGetLightningAddress()),
  checkLightningAddressAvailable: vi.fn().mockImplementation(mocks.mockCheckLightningAddressAvailable),
  registerLightningAddress: vi.fn().mockImplementation(mocks.mockRegisterLightningAddress),
  receiveLightning: vi.fn().mockImplementation(mocks.mockReceiveLightning),  
};
});
