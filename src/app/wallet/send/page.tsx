"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownUp, ArrowLeft, Clipboard, Contact as ContactIcon } from "lucide-react";
import { useT } from "@/lib/i18n/hook";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { DEFAULT_FIAT_CURRENCY } from "@/lib/wallet/prefs";
import { readAmountSat } from "@/lib/wallet/send-helpers";
import { useSendFlow } from "@/hooks/use-send-flow";
import { ContactsModal, ContactElement } from "@/components/wallet/contacts-modal";
import { SendConfirmStep } from "@/components/wallet/send-confirm-step";
import { SendError, SendProcessing, SendSuccess } from "@/components/wallet/send-result";

const AMOUNT_CONTROL_CLASS =
  "shrink-0 self-stretch inline-flex items-center px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:pointer-events-none";

export default function SendPage() {
  const t = useT();
  const {
    isUnlocked,
    step,
    destination,
    inputValue,
    isSats,
    prepareResult,
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
      <div className="min-h-screen min-w-fit bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button type="button"
              onClick={handleBack}
              aria-label={t("common.back")}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">{t("send.title")}</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t("send.available")}
                </p>
                <p className="text-3xl font-bold text-orange-500">
                  {isStableBalance
                  ? convertSatsToFiat({ sats: totalBalanceSats, ratePerBtc: usdRate || 0 })
                  : <>{totalBalanceSats.toLocaleString()} {t("send.sats")}</>}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between">
              <h2 className="text-lg font-semibold">{t("send.destination.title")}</h2>
              <button type="button" onClick={() => setShowContactsModal(true)}><ContactIcon className="min-w-6 min-h-6" /></button>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
                    <ArrowDownUp className="w-5 h-5" />
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
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("send.amount.helper")}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  onClick={handlePaste}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Clipboard className="w-4 h-4" />
                  <span>{t("send.paste")}</span>
                </Button>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleContinue}
                disabled={
                  !destination ||
                  isPreparing
                }
                loading={
                  isPreparing
                }
                className="w-full"
              >
                {isPreparing
                  ? t("send.checking")
                  : t("common.continue")}
              </Button>
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
