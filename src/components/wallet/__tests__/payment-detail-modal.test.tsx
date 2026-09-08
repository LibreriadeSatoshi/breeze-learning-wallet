import { renderWithProviders, screen } from "@/test/test-utils";
import { PaymentDetailModal } from "../payment-detail-modal";
import UserEvent from "@testing-library/user-event";
import { Payment } from "@/lib/lightning/types";
import { truncateStr } from "@/lib/wallet/truncate-str";

const payment: Payment = {
    "id": "01a081ac-7076-7180-a02a-f2125ed43f4a",
    "paymentType": "sent",
    "paymentTime": 1788881957,
    "amount": 120,
    "fees": 2,
    "status": "complete",
    "description": "Pay to OliveSheep3647@breez.tips",
    "bolt11": "lnbc1200n1p42qtpzpp54hq3l7le3u3ptfcj2ylkwxrhl9snf86jjqml6pt497puv2w57rqssp50csan63vpzwrdw383d2ltrqsqkd96epw209y69cvlnzwgmff3q4qxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpuhp5zgy6ptupr8rdmjkw78qsl07z7q8lfpydudhfgnhnu8pqtky8re2s9qyyssq0l06h3xs6armf24xtwr5lntdrtznxnv50nd3shqncq92urxspgsknhdmkcjjr3jhlhfr3nfpnedr3dlhxvh90d9zprw32qu55m300zgpmp83th",
    "method": "lightning"
}
const onClose = vi.fn();
describe("PaymentDetailModal", () => {
    it("should render the payment details", async () => {
        const user = UserEvent.setup();
        renderWithProviders(<PaymentDetailModal payment={payment} onClose={onClose} />);
        expect(screen.getByRole("dialog", { name: /payment details/i })).toBeInTheDocument();
        expect(screen.getByText(payment.amount)).toBeVisible();
        expect(screen.getByText(/complete/i)).toBeVisible();
        expect(screen.getByText("Sent")).toBeVisible();
        expect(screen.getByText(/2 sats/i)).toBeVisible();
        expect(screen.getByText("9\/8\/2026 11\:39 AM")).toBeVisible();
        if (payment.description) {
            expect(screen.getByText(payment.description)).toBeVisible();
        }
        const invoiceButton = screen.getByRole("button", { name: /invoice/i });
        const paymentIdButton = screen.getByRole("button", { name: /payment id/i });

        if (payment.bolt11) {
            expect(invoiceButton).toHaveTextContent(truncateStr(payment.bolt11, 8,6));
        }
        if (payment.id) {
            expect(paymentIdButton).toHaveTextContent(truncateStr(payment.id, 8,6));
        }
        expect(screen.getByRole("button", { name: /close/i })).toBeVisible()
    })
    it("should copy the invoice or payment id", async () => {
        const user = UserEvent.setup();
        renderWithProviders(<PaymentDetailModal payment={payment} onClose={onClose} />);
        const invoiceButton = screen.getByRole("button", { name: /invoice/i });
        const paymentIdButton = screen.getByRole("button", { name: /payment id/i });

        if (payment.bolt11) {
            await user.click(invoiceButton);
            expect(await navigator.clipboard.readText()).toBe(payment.bolt11);
        }
        if (payment.id) {
            await user.click(paymentIdButton);
            expect(await navigator.clipboard.readText()).toBe(payment.id);
        }
    })
    it("should close the modal", async () => {
        const user = UserEvent.setup();
        renderWithProviders(<PaymentDetailModal payment={payment} onClose={onClose} />);
        const closeButton = screen.getByRole("button", { name: /close/i });
        await user.click(closeButton);
        expect(onClose).toHaveBeenCalled();
    })
})