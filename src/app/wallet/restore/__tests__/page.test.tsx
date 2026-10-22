import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useWalletStore } from "@/store/wallet-store";
import RestoreWalletPage from "../page";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

async function restore(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /from recovery phrase/i }));
  await user.type(screen.getByRole("textbox"), MNEMONIC);
  await user.click(screen.getByRole("button", { name: /continue/i }));
  await user.type(screen.getByPlaceholderText(/at least 8 characters/i), "password123");
  await user.type(screen.getByPlaceholderText(/re-enter password/i), "password123");
  await user.click(screen.getByRole("button", { name: /restore wallet/i }));
}

describe("Restore page", () => {
  const createVault = vi.fn(async () => {
    useWalletStore.setState({ hasVault: true, isUnlocked: true });
  });

  beforeEach(() => {
    useWalletStore.setState({
      hasVault: false,
      isBootstrapped: true,
      createVault,
    });
  });

  it("does not offer to replace the wallet it has just restored", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RestoreWalletPage />);

    await restore(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/wallet/home"));
    expect(createVault).toHaveBeenCalledWith(MNEMONIC, "password123");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before replacing a wallet already on the device", async () => {
    useWalletStore.setState({ hasVault: true });
    renderWithProviders(<RestoreWalletPage />);

    expect(await screen.findByRole("dialog")).toHaveTextContent(/replace the wallet/i);
  });
});
