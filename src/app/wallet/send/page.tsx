"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, DataTransferBoth, Group, PasteClipboard } from "iconoir-react";
import { useT } from "@/lib/i18n/hook";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { DEFAULT_FIAT_CURRENCY } from "@/lib/wallet/prefs";
import { readAmountSat } from "@/lib/wallet/send-helpers";
import { useSendFlow } from "@/hooks/use-send-flow";
import { ContactsModal, ContactElement } from "@/components/wallet/contacts-modal";
import { SendConfirmStep } from "@/components/wallet/send-confirm-step";
import { SendError, SendProcessing, SendSuccess } from "@/components/wallet/send-result";

const AMOUNT_CONTROL_CLASS =
  "shrink-0 self-stretch inline-flex min-h-field min-w-[48px] items-center justify-center px-3 rounded border-1.5 border-input bg-surface text-body-sm font-medium text-fg hover:border-strong transition-colors duration-fast disabled:pointer-events-none disabled:border-hairline disabled:text-logwood-600";

export default function SendPage() {
  const t = useT();
  const {
    isUnlocked,
    step,
    destination,
    inputValue,
    isSats,
    prepareResult,
    isPending,
    error,
    contact,
    showContactsModal,
    isContactSelected,
    usdRate,
    totalBalanceSats,
    isStableBalance,
    isPreparing,
    isSending,
    handleDestinationChange,
    setShowContactsModal,
    setContact,
    handlePaste,
    handleMax,
    isMaxing,
    handleContinue,
    handleConfirmPayment,
    handleBack,
    handleRetry,
    handleAmountInput,
    toggleIsSats,
    onClickContact,
    handleRemoveContact,
    goHome,
  } = useSendFlow();

  if (!isUnlocked) return null;

  const isUsdRateAvailable: boolean = usdRate !== undefined && usdRate !== null;

  if (step === "input") {
    return (
      <div>
        <div className="max-w-reading mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2 mb-6">
            <button type="button"
              onClick={handleBack}
              aria-label={t("common.back")}
              className="-ml-3 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg hover:bg-raised transition-colors duration-fast"
            >
              <ArrowLeft aria-hidden="true" className="h-6 w-6" />
            </button>
            <h1 className="font-serif text-h2 text-heading">{t("send.title")}</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div>
                <p className="ism-label mb-2">
                  {t("send.available")}
                </p>
                <p className="font-mono text-h2 font-medium tabular-nums text-fg">
                  {isStableBalance
                  ? convertSatsToFiat({ sats: totalBalanceSats, ratePerBtc: usdRate || 0 })
                  : <>{totalBalanceSats.toLocaleString()} {t("send.sats")}</>}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <h2 className="font-serif text-h3 text-heading">{t("send.destination.title")}</h2>
              <button
                type="button"
                onClick={() => setShowContactsModal(true)}
                aria-label={t("send.contacts.title")}
                className="-mr-3 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg hover:bg-raised transition-colors duration-fast"
              >
                <Group aria-hidden="true" className="h-6 w-6" />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                label={t("send.destination.label")}
                placeholder={t("send.destination.placeholder")}
                value={destination}
                onChange={(e) => handleDestinationChange(e.target.value)}
                error={error || undefined}
                helperText={t("send.destination.helper")}
                inputType={isContactSelected ? "element" : "input"}
                element={<ContactElement contact={contact} removeContact={handleRemoveContact} />}
              />
              <div>
                <label
                  htmlFor="send-amount"
                  className="block text-body-sm font-semibold text-fg mb-2"
                >
                  {isSats ? t("send.amount.label") : t("send.amount.fiat", { currency: DEFAULT_FIAT_CURRENCY.toLocaleLowerCase() })}
                </label>
                <div className="flex flex-row gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      id="send-amount"
                      placeholder={t("send.amount.placeholder")}
                      value={inputValue}
                      onChange={(e) => handleAmountInput(e.target.value)}
                      inputMode={isSats ? "numeric" : "decimal"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleIsSats}
                    disabled={!isUsdRateAvailable}
                    aria-label={t("send.amount.toggleUnit")}
                    className={AMOUNT_CONTROL_CLASS}
                  >
                    <DataTransferBoth aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleMax}
                    disabled={
                      isMaxing || totalBalanceSats <= 0 || (!isSats && !isUsdRateAvailable)
                    }
                    className={AMOUNT_CONTROL_CLASS}
                  >
                    {isMaxing ? t("send.checking") : t("send.amount.max")}
                  </button>
                </div>
                <p className="mt-2 text-body-sm text-fg-muted">
                  {t("send.amount.helper")}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handlePaste}
                  className="w-full"
                >
                  <PasteClipboard aria-hidden="true" className="h-5 w-5" />
                  <span>{t("send.paste")}</span>
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleContinue}
                  disabled={!destination || isPreparing}
                  loading={isPreparing}
                  className="w-full"
                >
                  {isPreparing ? t("send.checking") : t("common.continue")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        {showContactsModal && <ContactsModal contact={contact} setContact={setContact} onClose={() => setShowContactsModal(false)} onClickContact={onClickContact} />}
      </div>
    );
  }

  if (step === "confirm" && prepareResult) {
    return (
      <SendConfirmStep
        prepareResult={prepareResult}
        usdRate={usdRate}
        error={error}
        isSending={isSending}
        onBack={handleBack}
        onConfirm={handleConfirmPayment}
      />
    );
  }


  if (step === "processing") return <SendProcessing />;

  if (step === "success") {
    return (
      <SendSuccess
        amountSat={prepareResult ? readAmountSat(prepareResult) ?? 0 : 0}
        pending={isPending}
        onDone={goHome}
      />
    );
  }

  if (step === "error") {
    return (
      <SendError
        message={error}
        onRetry={handleRetry}
        onCancel={goHome}
      />
    );
  }

  return null;
}
