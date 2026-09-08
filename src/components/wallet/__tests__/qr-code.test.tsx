import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { QrCode } from "../qr-code";

describe("QrCode", () => {
    it("should render a qr code", () => {
        renderWithProviders(<QrCode aria-label="qr code" value="https://example.com" />);
        
        waitFor(() =>
            expect(screen.getByRole("img", { name: /qr code/i })).toBeVisible()
        );
    });
});