import { renderWithProviders, screen } from "@/test/test-utils";
import { BuyBitcoinModal } from "../buy-bitcoin-modal";
import userEvent from '@testing-library/user-event'
import { buyBitcoin, onSdkEvent } from "@/lib/lightning/breez-service";

const CASH_APP_QUICK_AMOUNTS = ["10,000", "50,000", "100,000"];

describe("BuyBitcoinModal", () => {
    it("should render the BuyBitcoinModal selection step", () => {
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);
        const moonpayButton = screen.getByRole("button", { name: /moonpay/i });
        const cashappButton = screen.getByRole("button", { name: /cash app/i });

        expect(screen.getByRole("dialog", { name: /buy bitcoin/i })).toBeInTheDocument();
        expect(moonpayButton).toBeVisible();
        expect(cashappButton).toBeVisible();
    });
    it("click moonpay button", async () => {
        const user = userEvent.setup();
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);
        
        const moonpayButton = screen.getByRole("button", { name: /moonpay/i });
        await user.click(moonpayButton);

        expect(window.open).toHaveBeenCalledWith("", "_blank");
    });
    it("click cashapp button", async () => {
        const user = userEvent.setup();
    
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);
        
        const cashappButton = screen.getByRole("button", { name: /cash app/i });
        await user.click(cashappButton);
        
        expect(screen.getByText(/amount/i)).toBeVisible();
        expect(screen.getByPlaceholderText(/enter amount in satoshi/i)).toBeVisible();
    });
    it("click back button in amount step", async () => {
        const user = userEvent.setup();
    
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);
        
        const cashappButton = screen.getByRole("button", { name: /cash app/i });
        await user.click(cashappButton);
        
        const backButton = screen.getByRole("button", { name: /back/i });
        await user.click(backButton);
        
        expect(screen.queryByText(/amount/i)).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/enter amount in satoshi/i)).not.toBeInTheDocument();
    });
    it("should allow typing in the amount field", async () => {
        const user = userEvent.setup();
    
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);
        
        const cashappButton = screen.getByRole("button", { name: /cash app/i });
        await user.click(cashappButton);
        
        const amountInput = screen.getByPlaceholderText(/enter amount in satoshi/i);
        await user.type(amountInput, "100000");
        
        expect(amountInput).toHaveValue(100000);
    });
    test.for(CASH_APP_QUICK_AMOUNTS)("use predetermined amount %s", async (amount) => {
        const user = userEvent.setup();
    
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);
        
        const cashappButton = screen.getByRole("button", { name: /cash app/i });
        await user.click(cashappButton);
        
        const amountInput = screen.getByPlaceholderText(/enter amount in satoshi/i);

        const selectTenThousand = screen.getByRole("button", { name: amount.toString() });
        await user.click(selectTenThousand);
        const normalizedAmount = amount.replace(",", "");

        expect(amountInput).toHaveValue(Number(normalizedAmount));
    });

    it("renders QR step with QR SVG and allows copying the link", async () => {
        const user = userEvent.setup();
        
        renderWithProviders(<BuyBitcoinModal onClose={() => {}} />);

        await user.click(screen.getByRole("button", { name: /cash app/i }));
        await user.type(screen.getByPlaceholderText(/enter amount in satoshi/i), "100000");
        await user.click(screen.getByRole("button", { name: /continue/i }));
        
        const img = screen.getByRole("img", { name: /cash app qr/i });
        const copyButton = screen.getByRole("button", { name: /copy/i });
        
        expect(img).toBeVisible()
        expect(copyButton).toBeVisible()

        await user.click(copyButton);
        
        expect(await navigator.clipboard.readText()).toBe("https://cash.app/launch/pay/mocked-id");
        
        expect(buyBitcoin).toHaveBeenCalled()
        expect(onSdkEvent).toHaveBeenCalled()
    });
});