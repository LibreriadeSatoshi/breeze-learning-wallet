import { act, renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { InvoiceCreator } from "../invoice-creator";
import userEvent from '@testing-library/user-event'
import { useT } from "@/lib/i18n/hook";
import { useReceiveLightning } from "@/hooks/use-breez";

const InvoiceCreatorParent = () => {
    const t = useT();
    const receiveMutation = useReceiveLightning();

    return (
        <InvoiceCreator
            onReceived={vi.fn()}
            title={t("receive.invoice.title")}
            openLabel={t("receive.invoice.openLink")}
            isPending={receiveMutation.isPending}
            generate={({ amountSat, description }) =>
            receiveMutation.mutateAsync({ amountSat, description })
        }/>
    )
}

describe("InvoiceCreator", () => {
    it("should render the button to open the invoice creator", async () => {
        renderWithProviders(<InvoiceCreatorParent />)

        expect(screen.getByRole("button", { name: /create a one-time invoice/i })).toBeVisible()
    })
    it("should render the invoice creator card with two inputs", async () => {
        renderWithProviders(<InvoiceCreatorParent />)
        const user = userEvent.setup()
        const openLinkButton = screen.getByRole("button", { name: /create a one-time invoice/i })

        expect(openLinkButton).toBeVisible()

        await user.click(openLinkButton)

        expect(screen.getByText(/one-time invoice/i)).toBeVisible()
        expect(screen.getByRole("textbox", { name: /amount/i })).toBeVisible()
        expect(screen.getByRole("textbox", { name: /description/i })).toBeVisible()
        expect(screen.getByRole("button", { name: /generate/i })).toBeVisible()
    })
    it("shouldn't allow to generate an invoice without an amount", async () => {
        renderWithProviders(<InvoiceCreatorParent />)
        const user = userEvent.setup()
        const openLinkButton = screen.getByRole("button", { name: /create a one-time invoice/i })
        await user.click(openLinkButton)

        const generateButton = screen.getByRole("button", { name: /generate/i })
        expect(generateButton).toBeDisabled()

        await user.type(screen.getByRole("textbox", { name: /description/i }), "test")
        expect(generateButton).toBeDisabled()
    })
    it("create an invoice and show the invoice and the QR code", async () => {
        renderWithProviders(<InvoiceCreatorParent />)
        const user = userEvent.setup()
        const openLinkButton = screen.getByRole("button", { name: /create a one-time invoice/i })
        await user.click(openLinkButton)

        const generateButton = screen.getByRole("button", { name: /generate/i })
        await user.type(screen.getByRole("textbox", { name: /amount/i }), "100000")
        await user.type(screen.getByRole("textbox", { name: /description/i }), "test")
        await user.click(generateButton)        
        
        waitFor(() => {
            const qrCode = screen.getByRole("img", { name: /qr code/i })
            const truncatedInvoice = screen.getByText(/lnurl1dp68gu\.\.\.4ehgvssmnnfx/i)

            expect(qrCode).toBeVisible()
            expect(truncatedInvoice).toBeVisible()
        })
    })
    it("should copy the invoice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const copyTextMock = vi.spyOn(navigator.clipboard, "writeText");
    
    renderWithProviders(<InvoiceCreatorParent />);

    const openLinkButton = screen.getByRole("button", { name: /create a one-time invoice/i });
    await user.click(openLinkButton);

    await user.type(screen.getByRole("textbox", { name: /amount/i }), "100000");
    await user.type(screen.getByRole("textbox", { name: /description/i }), "test");
    await user.click(screen.getByRole("button", { name: /generate/i }));

    const copyButton = await screen.findByRole("button", { name: /copy/i });
    await user.click(copyButton);

    await waitFor(async () => {
        expect(copyTextMock).toHaveBeenCalled();
        expect(screen.getByText(/copied/i)).toBeVisible();
    })

    await act(async () => {
        vi.advanceTimersByTime(2000);
    });

    const actualClipboardText = await navigator.clipboard.readText();
    expect(actualClipboardText).not.toBe("");
    expect(actualClipboardText).toBe("lnurl1dp68gurn8ghj7urp0yh8xctww35kzem0vf5hger9weejummjvuhkcmn4wfk8qtm5v4ehgvssmnnfx");
    
    vi.useRealTimers();
});
})