import {renderWithProviders, screen} from "@/test/test-utils"
import { BalanceDisplay } from "../balance-display";
import userEvent from '@testing-library/user-event'

const token = {
    "balance": 780000,
    "tokenMetadata": {
        "identifier": "btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87",
        "issuerPublicKey": "024137d3a0a67d26254a0c87260a80e9ea3430945d4c9520d3f549f019171252a7",
        "name": "Bitcoin USD",
        "ticker": "USDB",
        "decimals": 6,
        "maxSupply": "0",
        "isFreezable": true
    }
}

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
    it("should render stable balance with estimated sats", () => {
        renderWithProviders(<BalanceDisplay balanceSat={1000} fiatRate={78000} usdRate={78000} fiatCurrency="USD" isStableBalance={true} token={token} />);
        
        expect(screen.getByText(/0\.78/i)).toBeVisible();
        expect(screen.getByText(/USDB/i)).toBeVisible();
        expect(screen.getByText(/1000 sats/i)).toBeVisible();
    })
    it("should render stable balance 0 with the remaining sats as change", () => {
        renderWithProviders(
            <BalanceDisplay
            balanceSat={780}
            fiatRate={78000}
            usdRate={78000}
            fiatCurrency="USD"
            isStableBalance={true}
            token={undefined}
            />
        );

        expect(screen.getByText(/0\.00/i)).toBeVisible();
        expect(screen.getByText(/USDB/i)).toBeVisible();
        expect(screen.getByText(/780.*change/i)).toBeVisible();
        });
})