import {renderWithProviders, screen} from "@/test/test-utils"
import { BalanceDisplay } from "../balance-display";
import userEvent from '@testing-library/user-event'
import { cleanup } from '@testing-library/react';

describe("BalanceDisplay", () => {
    it("should render balance in sats and estimated fiat", () => {
        renderWithProviders(<BalanceDisplay balanceSat={1000} fiatRate={78000} usdRate={78000} fiatCurrency="USD" isStableBalance={false} token={undefined} />);

        expect(screen.getByText(/1,000/i)).toBeVisible();
        expect(screen.queryByText(/sats/i)).toBeVisible()
        expect(screen.getByText(/≈ \$0\.78/i)).toBeVisible();
    })
    it("should render balance without estimated fiat", () => {
        renderWithProviders(<BalanceDisplay balanceSat={1000} fiatRate={undefined} usdRate={undefined} fiatCurrency="" isStableBalance={false} token={undefined} />);

        expect(screen.getByText(/1,000/i)).toBeVisible();
        expect(screen.queryByText(/sats/i)).toBeVisible()
        expect(screen.queryByText(/≈ \$0\.78/i)).not.toBeInTheDocument();
    })
    it("hide sensitive data", async () => {
        renderWithProviders(<BalanceDisplay balanceSat={1000} fiatRate={78000} usdRate={78000} fiatCurrency="USD" isStableBalance={false} token={undefined} />);

        const button = screen.getByRole("button");
        await userEvent.click(button);

        expect(screen.queryByText(/1,000/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/sats/i)).toBeVisible()
        expect(screen.queryByText(/\$0\.78/i)).not.toBeInTheDocument();
    })
    it("shows correct ticker for USD", () => {
        renderWithProviders(<BalanceDisplay balanceSat={1000} fiatRate={78000} usdRate={78000} fiatCurrency="USD" isStableBalance={false} token={undefined} />);
        expect(screen.getByText(/\$0\.78/i)).toBeVisible();
    });

    it("shows correct ticker for EUR", () => {
        renderWithProviders(<BalanceDisplay balanceSat={1000} fiatRate={67000} usdRate={78000} fiatCurrency="EUR" isStableBalance={false} token={undefined} />);
        expect(screen.getByText(/€0\.67/i)).toBeVisible();
    });
})