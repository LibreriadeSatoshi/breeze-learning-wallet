let clipboardBuffer = "";

export const clipboardMock = {
    writeText: vi.fn().mockImplementation(async (text: string) => {
        clipboardBuffer = text;
    }),
    readText: vi.fn().mockImplementation(async () => {
        return clipboardBuffer;
    }),
};

export const createMockWindow = (): Partial<Window> => ({
  location: { href: "" } as Location,
  close: vi.fn(),
});

export const windowDefineProperty = () => {
    delete (window as any).location;
    
    Object.defineProperty(window, "location", {
      value: {
        origin: "https://wallet.libreriadesatoshi.com",
        href: "https://wallet.libreriadesatoshi.com/wallet/home",
        assign: vi.fn(),
        replace: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, "clipboard", {
        value: clipboardMock,
        writable: true,
        configurable: true,
    });
}