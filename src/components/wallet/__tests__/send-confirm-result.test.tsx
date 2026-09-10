import { SendConfirmStep } from "../send-confirm-step";
import { renderWithProviders, screen } from "@/test/test-utils";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { PrepareResult } from "@/lib/wallet/send-helpers";
import userEvent from "@testing-library/user-event";
import { SendSuccess, SendError, SendProcessing } from "../send-result";

let prepareResult: PrepareResult = {
    "kind": "lnurlPay",
    "data": {
        "amountSats": 100,
        "payRequest": {
            "callback": "https://breez.tips/lnurlp/olivesheep3647/invoice",
            "minSendable": 1000,
            "maxSendable": 100000000000,
            "metadataStr": "[[\"text/plain\",\"Pay to OliveSheep3647@breez.tips\"],[\"text/identifier\",\"olivesheep3647@breez.tips\"]]",
            "commentAllowed": 255,
            "domain": "breez.tips",
            "url": "https://breez.tips/.well-known/lnurlp/olivesheep3647",
            "address": "olivesheep3647@breez.tips",
            "allowsNostr": true,
            "nostrPubkey": "16d3736bb6e753e73fc79437e03e8929f33248aea8fb41bd71e4d943d580f6c1"
        },
        "feeSats": 2,
        "invoiceDetails": {
            "amountMsat": 1000,
            "descriptionHash": "1209a0af8119c6ddcacef1c10fbfc2f00ff4848de36e944ef3e1c205d8871e55",
            "expiry": 2592000,
            "invoice": {
                "bolt11": "lnbc10n1p42rxvwpp54c2ycz3msganglmdjwmhgn0ekspcmuhd4vtjzhg6uwkkf99jghsqsp5wyfdhe67mkwhf07jllmtndxz2wrg2lfrfxsu5y6gk7yf20xmh0lsxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpuhp5zgy6ptupr8rdmjkw78qsl07z7q8lfpydudhfgnhnu8pqtky8re2s9qyyssq3rsewrgj0wf76tyy9dklxyw605m6ezxaqpu4armmau8y7xlhmz5kmfm6g83k5mpkn0tqfdx9tvghr7lgamt3sj42jetd7q4saeymm4gqkzd6vp",
                "source": {}
            },
            "minFinalCltvExpiryDelta": 60,
            "network": "bitcoin",
            "payeePubkey": "030936e7a016fb3f5ce53c8db29da2b6dfbf8e068ea058c363e0fd77f444270d8a",
            "paymentHash": "ae144c0a3b823b347f6d93b7744df9b4038df2edab17215d1ae3ad6494b245e0",
            "paymentSecret": "7112dbe75edd9d74bfd2fff6b9b4c25386857d2349a1ca1348b788953cdbbbff",
            "routingHints": [
                {
                    "hops": [
                        {
                            "srcNodeId": "02a98e8c590a1b5602049d6b21d8f4c8861970aa310762f42eae1b2be88372e924",
                            "shortChannelId": "0x14111487x27584",
                            "feesBaseMsat": 0,
                            "feesProportionalMillionths": 1000,
                            "cltvExpiryDelta": 40
                        }
                    ]
                }
            ],
            "timestamp": 1788975502
        },
        "feePolicy": "feesExcluded"
    },
    "domain": "breez.tips"
    }
let usdRate: number = 78000;
let error = ""
let isSending = false
const handleBack = vi.fn()
const handleConfirmPayment = vi.fn()

const SendConfirm = () => {
    return (
        <SendConfirmStep 
            prepareResult={prepareResult as PrepareResult}
            usdRate={usdRate}
            error={error}
            isSending={isSending}
            onBack={handleBack}
            onConfirm={handleConfirmPayment}
        />
    )
}

describe("SendConfirmStep", () => {
    it("should render the confirm step", () => {
        const conversionToUsd = convertSatsToFiat({sats: prepareResult.data.amountSats, ratePerBtc: usdRate})
        renderWithProviders(<SendConfirm />);

        const amountSats = screen.getByText(prepareResult.data.amountSats)
        const amountUsd = screen.getByText(`≈ ${conversionToUsd}`)
        const fee = screen.getByText(`${prepareResult.data.feeSats} sats`)
        const total = screen.getByText(`${prepareResult.data.feeSats + prepareResult.data.amountSats} sats`)
        const button = screen.getByRole('button', { name: /confirm & send payment/i })
        
        expect(screen.getByRole('heading', { name: /confirm payment/i })).toBeVisible();
        expect(screen.getByText(/you're sending/i)).toBeVisible()
        expect(amountSats).toBeVisible()
        expect(amountUsd).toBeVisible()
        expect(fee).toBeVisible()
        expect(total).toBeVisible()
        expect(button).toBeVisible()
    })
    it("should go back", async () => {
        const user = userEvent.setup();
        renderWithProviders(<SendConfirm />);
        const button = screen.getByRole('button', { name: /back/i })
        await user.click(button)

        expect(handleBack).toHaveBeenCalledTimes(1)
    })

    it("should confirm the payment", async () => {
        renderWithProviders(<SendConfirm />);
        const button = screen.getByRole('button', { name: /confirm & send payment/i })
        await userEvent.click(button)

        expect(handleConfirmPayment).toHaveBeenCalledTimes(1)
    })
})

const onDone = vi.fn()
const onCancel = vi.fn()
const onRetry = vi.fn()

describe("SendResult", () => {
    it("should render send processing", () => {
        renderWithProviders(<SendProcessing />);
        expect(screen.getByText(/sending payment/i)).toBeVisible()
    })
    it("should render send success", async () => {
        const user = userEvent.setup();
        renderWithProviders(<SendSuccess amountSat={prepareResult.data.amountSats} onDone={onDone} />);

        expect(screen.getByText(/payment sent/i)).toBeVisible()
        expect(screen.getByText(`${prepareResult.data.amountSats} sats`)).toBeVisible()
        
        const button = screen.getByRole('button', { name: /back to wallet/i })
        expect(button).toBeVisible()

        await user.click(button)
        expect(onDone).toHaveBeenCalledTimes(1)
    })
    it("should render send error", async () => {
        renderWithProviders(<SendError message="error while sending" onCancel={onCancel} onRetry={onRetry} />);
        expect(screen.getByText(/error while sending/i)).toBeVisible()
        const cancelButton = screen.getByRole('button', { name: /cancel/i })
        const retryButton = screen.getByRole('button', { name: /try again/i })

        expect(cancelButton).toBeVisible()
        expect(retryButton).toBeVisible()

        await userEvent.click(cancelButton)
        expect(onCancel).toHaveBeenCalledTimes(1)

        await userEvent.click(retryButton)
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})