import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { QrCode } from "../qr-code";

describe("QrCode", () => {
    it("should render a qr code", async () => {
        renderWithProviders(<QrCode aria-label="qr code" value="https://example.com" />);
        
        await waitFor(() =>
            expect(screen.getByRole("img", { name: /qr code/i })).toBeVisible()
        );
    });
});