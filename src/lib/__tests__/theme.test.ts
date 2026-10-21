import {
  THEME_INIT_SCRIPT,
  THEME_KEY,
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  watchSystemTheme,
} from "../theme";

function mockSystemDark(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn().mockReturnValue(query);
  return {
    listeners,
    change(nextDark: boolean) {
      query.matches = nextDark;
      listeners.forEach((cb) => cb());
    },
  };
}

describe("theme", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    document.head.innerHTML = "";
    mockSystemDark(false);
  });

  it("defaults to following the device and ignores unknown stored values", () => {
    expect(getThemePreference()).toBe("system");
    localStorage.setItem(THEME_KEY, "neon");
    expect(getThemePreference()).toBe("system");
  });

  it("resolves the device preference to light or Hacker mode", () => {
    mockSystemDark(true);
    expect(resolveTheme("system")).toBe("hacker");
    mockSystemDark(false);
    expect(resolveTheme("system")).toBe("light");
    expect(resolveTheme("hacker")).toBe("hacker");
  });

  it("stores the choice and applies it to the document and theme-color", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);

    setThemePreference("hacker");

    expect(localStorage.getItem(THEME_KEY)).toBe("hacker");
    expect(document.documentElement.dataset.theme).toBe("hacker");
    expect(meta.content).toBe("#000000");

    setThemePreference("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(meta.content).toBe("#ffffff");
  });

  it("follows device changes while set to the device preference", () => {
    const system = mockSystemDark(false);
    applyTheme("system");
    const stop = watchSystemTheme(() => applyTheme("system"));

    system.change(true);
    expect(document.documentElement.dataset.theme).toBe("hacker");

    stop();
    expect(system.listeners.size).toBe(0);
  });

  it("applies the stored choice from the inline head script", () => {
    localStorage.setItem(THEME_KEY, "hacker");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe("hacker");

    localStorage.setItem(THEME_KEY, "system");
    mockSystemDark(false);
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
