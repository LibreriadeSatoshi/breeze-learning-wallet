import { renderWithProviders, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { getLightningAddress, registerLightningAddress } from "@/lib/lightning/breez-service";
import { useWalletStore } from "@/store/wallet-store";
import ReceivePage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("Receive page", () => {
  beforeEach(() => {
    useWalletStore.setState({ isUnlocked: true });
    vi.mocked(getLightningAddress).mockResolvedValue(null);
    vi.mocked(registerLightningAddress).mockRejectedValue(new Error("LNURL server is not configured"));
  });

  it("claims a Lightning address once and leaves retrying to the user", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReceivePage />);

    const retry = await screen.findByRole("button", { name: /try again/i });
    expect(screen.getByText(/LNURL server is not configured/)).toBeVisible();
    expect(registerLightningAddress).toHaveBeenCalledTimes(3);

    await user.click(retry);
    await screen.findByRole("button", { name: /try again/i });
    expect(registerLightningAddress).toHaveBeenCalledTimes(6);
  });
});
