import type { InputType, PrepareSendPaymentResponse } from "@breeztech/breez-sdk-spark";
import { renderWithProviders, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import {
  executeSend,
  parseInput,
  prepareSend,
  waitForPaymentOutcome,
} from "@/lib/lightning/breez-service";
import { WALLET_NETWORK } from "@/lib/wallet/send-helpers";
import { useWalletStore } from "@/store/wallet-store";
import SendPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/lightning/breez-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lightning/breez-service")>()),
  getBalance: vi.fn(async () => ({ totalSats: 100_000 })),
  getUserSettings: vi.fn(async () => ({})),
  listFiatRates: vi.fn(async () => []),
  parseInput: vi.fn(),
  prepareSend: vi.fn(),
  executeSend: vi.fn(),
  waitForPaymentOutcome: vi.fn(),
}));

const ADDRESS = "bcrt1qrecipientaddress0000000000000000000";

function onchainPrep(amount: number): PrepareSendPaymentResponse {
  const quote = { userFeeSat: 200, l1BroadcastFeeSat: 0 };
  return {
    amount: BigInt(amount),
    feePolicy: "feesExcluded",
    paymentMethod: {
      type: "bitcoinAddress",
      address: { address: ADDRESS },
      feeQuote: { speedFast: quote, speedMedium: quote, speedSlow: quote },
    },
  } as PrepareSendPaymentResponse;
}

async function submit(user: ReturnType<typeof userEvent.setup>, destination: string, amount?: string) {
  await user.type(screen.getByRole("textbox", { name: /invoice, lightning address/i }), destination);
  if (amount) await user.type(screen.getByPlaceholderText("0"), amount);
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

describe("Send page", () => {
  beforeEach(() => {
    useWalletStore.setState({ isUnlocked: true });
  });

  it("pays a BIP21 link with its amount and shows the recipient and note", async () => {
    vi.mocked(parseInput).mockResolvedValue({
      type: "bip21",
      uri: `bitcoin:${ADDRESS}`,
      extras: [],
      amountSat: 3000,
      message: "Rent",
      paymentMethods: [{ type: "bitcoinAddress", address: ADDRESS, network: WALLET_NETWORK }],
    } as unknown as InputType);
    vi.mocked(prepareSend).mockResolvedValue(onchainPrep(3000));
    const user = userEvent.setup();
    renderWithProviders(<SendPage />);

    await submit(user, `bitcoin:${ADDRESS}?amount=0.00003&message=Rent`);

    expect(await screen.findByText(/confirm payment/i)).toBeVisible();
    expect(prepareSend).toHaveBeenCalledWith(ADDRESS, 3000);
    expect(screen.getByTitle(ADDRESS)).toBeVisible();
    expect(screen.getByText("Rent")).toBeVisible();
  });

  it("lets an invoice's own amount win over a typed one", async () => {
    vi.mocked(parseInput).mockResolvedValue({
      type: "bolt11Invoice",
      invoice: { bolt11: "lnbcrt10u1fixed" },
      amountMsat: 1_000_000,
      network: WALLET_NETWORK,
    } as unknown as InputType);
    vi.mocked(prepareSend).mockRejectedValue(new Error("stop after prepare"));
    const user = userEvent.setup();
    renderWithProviders(<SendPage />);

    await submit(user, "lnbcrt10u1fixed", "5000");

    expect(prepareSend).toHaveBeenCalledWith("lnbcrt10u1fixed", undefined);
    expect(screen.getByPlaceholderText("0")).toHaveValue("1000");
  });

  it("stops a destination from another network before preparing", async () => {
    const other = WALLET_NETWORK === "bitcoin" ? "regtest" : "bitcoin";
    vi.mocked(parseInput).mockResolvedValue({
      type: "bitcoinAddress",
      address: "bc1qother",
      network: other,
    } as unknown as InputType);
    const user = userEvent.setup();
    renderWithProviders(<SendPage />);

    await submit(user, "bc1qother", "1000");

    expect(await screen.findByText(/different bitcoin network/i)).toBeVisible();
    expect(prepareSend).not.toHaveBeenCalled();
  });

  it("says a payment link's only invoice has expired", async () => {
    vi.mocked(parseInput).mockResolvedValue({
      type: "bip21",
      uri: "bitcoin:?lightning=lnbcrt1old",
      extras: [],
      paymentMethods: [
        {
          type: "bolt11Invoice",
          invoice: { bolt11: "lnbcrt1old" },
          network: WALLET_NETWORK,
          timestamp: 1_000,
          expiry: 3600,
        },
      ],
    } as unknown as InputType);
    const user = userEvent.setup();
    renderWithProviders(<SendPage />);

    await submit(user, "bitcoin:?lightning=lnbcrt1old");

    expect(await screen.findByText(/this invoice has expired/i)).toBeVisible();
    expect(prepareSend).not.toHaveBeenCalled();
  });

  describe("after confirming", () => {
    beforeEach(() => {
      vi.mocked(parseInput).mockResolvedValue({
        type: "bitcoinAddress",
        address: ADDRESS,
        network: WALLET_NETWORK,
      } as unknown as InputType);
      vi.mocked(prepareSend).mockResolvedValue(onchainPrep(1000));
      vi.mocked(executeSend).mockResolvedValue({
        payment: { id: "p1", status: "pending" },
      } as Awaited<ReturnType<typeof executeSend>>);
    });

    async function confirm() {
      const user = userEvent.setup();
      renderWithProviders(<SendPage />);
      await submit(user, ADDRESS, "1000");
      await user.click(await screen.findByRole("button", { name: /confirm & send/i }));
    }

    it("sends once per confirmed payment and says when it is still settling", async () => {
      vi.mocked(waitForPaymentOutcome).mockResolvedValue("pending");
      await confirm();

      expect(await screen.findByText(/payment on its way/i)).toBeVisible();
      const [, key] = vi.mocked(executeSend).mock.calls[0];
      expect(key).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("reports a payment that failed after it was sent", async () => {
      vi.mocked(waitForPaymentOutcome).mockResolvedValue("failed");
      await confirm();

      expect(await screen.findByText(/couldn't be delivered/i)).toBeVisible();
    });
  });
});
