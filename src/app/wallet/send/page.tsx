"use client";

import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, ArrowLeft, Check, Clipboard, X, Contact as ContactIcon, UserRoundPlus, SquarePen, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import {
  useBalance,
  useParseInput,
  usePrepareSend,
  useExecuteSend,
  usePrepareLnurlPay,
  useExecuteLnurlPay,
  useUserSettings,
  useContacts,
  useContactsAction,
} from "@/hooks/use-breez";
import { useFiat } from "@/hooks/use-fiat";
import { convertSatsToFiat, SATS_PER_BTC } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import {
  type PrepareSendResult,
  type PrepareLnurlPayResult,
  usdbTicker,
} from "@/lib/lightning/breez-service";
import type {  Contact, InputType, LnurlPayRequestDetails } from "@breeztech/breez-sdk-spark";
import { estimateSats } from "@/components/wallet/balance-display";
import { DEFAULT_FIAT_CURRENCY } from "@/lib/wallet/prefs";
import { Modal } from "@/components/ui/modal";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

const AMOUNT_CONTROL_CLASS =
  "shrink-0 self-stretch inline-flex items-center px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:pointer-events-none";

type PrepareResult =
  | { kind: "send"; data: PrepareSendResult; destinationKind: SendDestinationKind }
  | { kind: "lnurlPay"; data: PrepareLnurlPayResult; domain: string };

type SendDestinationKind =
  | "bolt11"
  | "bolt12"
  | "bitcoinAddress"
  | "sparkAddress"
  | "sparkInvoice"
  | "bip21";

export default function SendPage() {
  const t = useT();
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isSats, setIsSats] = useState(true);
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState("");
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [isContactSelected, setIsContactSelected] = useState(false);
  const [contact, setContact] = useState<Contact>({name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0})
  const maxedRef = useRef(false);

  const { data: balances } = useBalance(true);
  const { estableRate: usdRate } = useFiat(true);
  const {data: userSettings} = useUserSettings(true);
  const parseMutation = useParseInput();
  const prepareMutation = usePrepareSend();
  const executeMutation = useExecuteSend();
  const prepareLnurlMutation = usePrepareLnurlPay();
  const executeLnurlMutation = useExecuteLnurlPay();

  const isStableBalance = userSettings?.stableBalanceActiveLabel === usdbTicker;

  const tokenUSDB = balances?.tokenUSDB;
  const totalBalanceSats = (estimateSats(tokenUSDB?.balance || 0, usdRate, tokenUSDB?.tokenMetadata?.decimals) || 0) + (balances?.totalSats || 0);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDestination(text.trim());
        setError("");
      }
    } catch {
      setError(t("send.pasteFailed"));
    }
  };

  const parseSats = (value: string): number | undefined => {
    if (isSats) {
      const cleanSatsText = value.replace(/\D/g, "");
      return Number.parseInt(cleanSatsText, 10) || 0;
    } else {
      if (!usdRate) return undefined;
      const cleanFiatText = value.replace(/[^0-9.]/g, "");
      const usd = Number.parseFloat(cleanFiatText) || 0;
      return Math.round((usd / usdRate) * SATS_PER_BTC);
    }
  };

  const satsToInputValue = (sats: number, forSats: boolean = isSats): string => {
    if (forSats) return sats.toString();
    if (!usdRate) return "";
    return ((sats / SATS_PER_BTC) * usdRate).toFixed(2);
  };

  const handleMax = () => {
    setInputValue(satsToInputValue(totalBalanceSats));
    maxedRef.current = true;
    setError("");
  };


  const handleContinue = async () => {
    setError("");
    const dest = destination.trim();
    if (!dest) {
      setError(t("send.destinationRequired"));
      return;
    }
    try {
      const parsed = await parseMutation.mutateAsync(dest);
      const unsupported = describeUnsupported(parsed, t);
      if (unsupported) {
        setError(unsupported);
        return;
      }

      const amountSat = inputValue ? parseSats(inputValue) : undefined;

      const prepareFor = async (
        amt: number | undefined,
      ): Promise<PrepareResult | null> => {
        if (parsed.type === "lnurlPay" || parsed.type === "lightningAddress") {
          const payRequest: LnurlPayRequestDetails =
            parsed.type === "lightningAddress"
              ? parsed.payRequest
              : pickLnurlPayDetails(parsed);
          if (!amt || amt <= 0) {
            setError(t("send.lnurlAmountRequired"));
            return null;
          }
          const minSat = Math.ceil(payRequest.minSendable / 1000);
          const maxSat = Math.floor(payRequest.maxSendable / 1000);
          if (amt < minSat || amt > maxSat) {
            setError(t("send.lnurlRange", { min: minSat.toLocaleString(), max: maxSat.toLocaleString() }));
            return null;
          }
          const lnurlPrep = await prepareLnurlMutation.mutateAsync({
            payRequest,
            amountSat: amt,
          });
          return { kind: "lnurlPay", data: lnurlPrep, domain: payRequest.domain };
        }
        const sendPrep = await prepareMutation.mutateAsync({
          destination: dest,
          amountSat: amt,
        });
        return {
          kind: "send",
          data: sendPrep,
          destinationKind: destinationKindForParsed(parsed),
        };
      };

      let prep = await prepareFor(amountSat);
      if (!prep) return;

      const net = totalBalanceSats - readFeeSat(prep);
      if (maxedRef.current && net > 0 && overspends(prep, totalBalanceSats)) {
        prep = await prepareFor(net);
        if (!prep) return;
      }

      if (overspends(prep, totalBalanceSats)) {
        setError(t("send.insufficientBalance", { balance: totalBalanceSats.toLocaleString() }));
        return;
      }
      setPrepareResult(prep);
      setStep("confirm");
    } catch (err) {
      setError(sendErrorMessage(err, t, "send.parseFailed"));
    }
  };

  const handleConfirmPayment = async () => {
    if (!prepareResult) return;
    setStep("processing");
    setError("");
    try {
      if (prepareResult.kind === "send") {
        await executeMutation.mutateAsync(prepareResult.data);
      } else {
        await executeLnurlMutation.mutateAsync(prepareResult.data);
      }
      setStep("success");
      setTimeout(() => router.push("/wallet/home"), 2000);
    } catch (err) {
      setError(sendErrorMessage(err, t, "send.failed"));
      setStep("error");
    }
  };

  const handleBack = () => {
    if (step === "confirm") setStep("input");
    else router.back();
  };

  const handleRetry = () => {
    setStep("input");
    setError("");
    setDestination("");
    setInputValue("");
    setPrepareResult(null);
    maxedRef.current = false;
  };

  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawText = e.target.value;
    maxedRef.current = false;

    if (isSats) {
      setInputValue(rawText.replace(/\D/g, ""));
      return;
    }

    if (!usdRate) return;
    let cleanFiatText = rawText.replace(/[^0-9.]/g, "");
    const parts = cleanFiatText.split(".");

    if (parts.length > 2) {
      cleanFiatText = `${parts[0]}.${parts.slice(1).join("")}`;
    }

    if (parts.length >= 2) {
      cleanFiatText = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }

    setInputValue(cleanFiatText);
  };

  const toggleIsSats = () => {
    setIsSats((prevIsSats) => {
      const nextIsSats = !prevIsSats;
      const rawSats = parseSats(inputValue);

      if (!rawSats) {
        setInputValue("");
        return nextIsSats;
      }

      setInputValue(satsToInputValue(rawSats, nextIsSats));

      return nextIsSats;
    });
  };

  const onClickContact = useCallback((contact: Contact) => {
    setContact(contact)
    setDestination(contact.paymentIdentifier)
    setStep("input")
    setShowContactsModal(false)
    setIsContactSelected(true)
    maxedRef.current = false
  }, [])

  const handleRemoveContact = useCallback(() => {
    setContact({ name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0 })
    setDestination("")
    setIsContactSelected(false)
    maxedRef.current = false
  }, [])

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
                onChange={(e) => {
                  setDestination(e.target.value);
                  setError("");
                  maxedRef.current = false;
                }}
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
                      onChange={handleAmountInput}
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
                    disabled={totalBalanceSats <= 0 || (!isSats && !isUsdRateAvailable)}
                    className={AMOUNT_CONTROL_CLASS}
                  >
                    {t("send.amount.max")}
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
                  prepareMutation.isPending ||
                  prepareLnurlMutation.isPending ||
                  parseMutation.isPending
                }
                loading={
                  prepareMutation.isPending ||
                  prepareLnurlMutation.isPending ||
                  parseMutation.isPending
                }
                className="w-full"
              >
                {prepareMutation.isPending ||
                prepareLnurlMutation.isPending ||
                parseMutation.isPending
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
    const amountSat = readAmountSat(prepareResult) ?? 0;
    const feesSat = readFeeSat(prepareResult);
    const destLabel = describeDestination(prepareResult, t);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button type="button"
              onClick={handleBack}
              aria-label={t("common.back")}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">{t("send.confirmTitle")}</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t("send.youreSending")}
                </p>
                <p className="text-5xl font-bold text-orange-500 mb-2">
                  {amountSat.toLocaleString()}
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-400">{t("send.sats")}</p>
                {usdRate !== undefined && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    ≈ {convertSatsToFiat({sats: amountSat, ratePerBtc: usdRate, currency: DEFAULT_FIAT_CURRENCY})}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">{t("send.details")}</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t("send.type")}</span>
                <span className="font-medium">{destLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t("send.networkFee")}</span>
                <span className="font-medium">{feesSat.toLocaleString()} {t("send.sats")}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold">{t("send.total")}</span>
                <span className="font-bold text-orange-500">
                  {(amountSat + feesSat).toLocaleString()} {t("send.sats")}
                </span>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirmPayment}
            disabled={executeMutation.isPending || executeLnurlMutation.isPending}
            loading={executeMutation.isPending || executeLnurlMutation.isPending}
            className="w-full"
          >
            {executeMutation.isPending || executeLnurlMutation.isPending
              ? t("send.processing")
              : t("send.confirmSend")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <h2 className="text-2xl font-bold mb-2">{t("send.sendingPayment")}</h2>
        </div>
      </div>
    );
  }

  if (step === "success") {
    const amountSat = prepareResult ? readAmountSat(prepareResult) ?? 0 : 0;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600 dark:text-green-400" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-green-600">{t("send.sent")}</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            {amountSat.toLocaleString()} {t("send.sats")}
          </p>
          <Button variant="primary" onClick={() => router.push("/wallet/home")}>
            {t("send.backToWallet")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <X className="w-10 h-10 text-red-600 dark:text-red-400" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-red-600">{t("send.failed")}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            {error || t("send.genericError")}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/wallet/home")}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={handleRetry}>
              {t("send.tryAgain")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function pickLnurlPayDetails(
  parsed: Extract<InputType, { type: "lnurlPay" }>,
): LnurlPayRequestDetails {
  return {
    callback: parsed.callback,
    minSendable: parsed.minSendable,
    maxSendable: parsed.maxSendable,
    metadataStr: parsed.metadataStr,
    commentAllowed: parsed.commentAllowed,
    domain: parsed.domain,
    url: parsed.url,
    address: parsed.address,
    allowsNostr: parsed.allowsNostr,
    nostrPubkey: parsed.nostrPubkey,
  };
}

function readAmountSat(prep: PrepareResult): number | null {
  if (prep.kind === "lnurlPay") return prep.data.amountSats;
  return Number(prep.data.amount);
}

function sendErrorMessage(
  err: unknown,
  t: (k: string) => string,
  fallbackKey: string,
): string {
  const raw = err instanceof Error ? err.message : "";
  if (/self payment/i.test(raw)) return t("send.selfPayment");
  return raw || t(fallbackKey);
}

function overspends(prep: PrepareResult, balanceSat: number): boolean {
  if (prep.kind === "send") {
    const { tokenIdentifier, paymentMethod } = prep.data;
    if (tokenIdentifier || paymentMethod.type === "crossChainAddress") return false;
  }
  const amountSat = readAmountSat(prep);
  if (amountSat === null) return false;
  const spend =
    prep.data.feePolicy === "feesIncluded" ? amountSat : amountSat + readFeeSat(prep);
  return spend > balanceSat;
}

function readFeeSat(prep: PrepareResult): number {
  if (prep.kind === "lnurlPay") return prep.data.feeSats;
  const m = prep.data.paymentMethod;
  switch (m.type) {
    case "bolt11Invoice":
      return m.lightningFeeSats + (m.sparkTransferFeeSats ?? 0);
    case "bitcoinAddress":
      return m.feeQuote.speedMedium.userFeeSat + m.feeQuote.speedMedium.l1BroadcastFeeSat;
    case "sparkAddress":
    case "sparkInvoice":
      return m.tokenIdentifier ? 0 : Number(m.fee);
    case "crossChainAddress":
      // feeAmount is in the destination asset's base units, not sats.
      return m.sourceTransferFeeSats;
  }
}

function destinationKindForParsed(parsed: InputType): SendDestinationKind {
  switch (parsed.type) {
    case "bolt11Invoice":
      return "bolt11";
    case "bolt12Offer":
    case "bolt12Invoice":
    case "bolt12InvoiceRequest":
      return "bolt12";
    case "bitcoinAddress":
      return "bitcoinAddress";
    case "sparkAddress":
      return "sparkAddress";
    case "sparkInvoice":
      return "sparkInvoice";
    case "bip21":
      return "bip21";
    default:
      return "bolt11";
  }
}

function describeDestination(
  prep: PrepareResult,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  if (prep.kind === "lnurlPay") return t("send.destinationKind.lnurlPay", { domain: prep.domain });
  return t(`send.destinationKind.${prep.destinationKind}`);
}

function describeUnsupported(
  parsed: InputType,
  t: (k: string) => string,
): string | null {
  switch (parsed.type) {
    case "lnurlAuth":
      return t("send.unsupported.lnurlAuth");
    case "lnurlWithdraw":
      return t("send.unsupported.lnurlWithdraw");
    case "url":
      return t("send.unsupported.url");
    case "silentPaymentAddress":
      return t("send.unsupported.silentPayment");
    default:
      return null;
  }
}

const AddContactButton = ({ onClick }: { onClick: () => void }) => {
    return (
      <button type="button" onClick={onClick}>
        <UserRoundPlus className="w-6 h-6"/>
      </button>
    )
}



const ContactsModal = ({ onClose, onClickContact, setContact, contact }: { onClose: () => void, onClickContact: (contact: Contact) => void, setContact: (contact: Contact) => void, contact: Contact}) => {
  type ContactStep = "list" | "add" | "update" | "confirm"

  const t = useT()

  const [step, setStep] = useState<ContactStep>("list")
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const { mutateAsync: contactActions } = useContactsAction();

  const handleAddContact = () => {
    setStep("add")
  }

  const handleUpdateContact = (contact: Contact) => {
    setStep("update")
    setContact(contact)
  }

  const handleConfirm = (contact: Contact) => {
    setStep("confirm")
    setContact(contact)
  }

  const deleteContact = async (contact: Contact) => {
    try {
      await contactActions({action: "remove", id: contact.id})
    } catch (error) {
      setError((error as Error).message)
    }
    setStep("list")
  }

  const saveContact = async () => {
    try {
      if (step === "add") {
        await contactActions({action: "add", name: contact.name, paymentIdentifier: contact.paymentIdentifier})
        setStep("list")
        setContact({name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0})
      }
      if (step === "update") {
        await contactActions({action: "update", id: contact.id, name: contact.name, paymentIdentifier: contact.paymentIdentifier})
        setStep("list")
        setContact({name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0})
      }
    } catch (err) {
      let errorMsg = (err as Error).message
      if (errorMsg.includes("Invalid input")) {
        setError(t("send.contacts.errors.invalid"))
      } else if (errorMsg.includes("Name is required")) {
        setError(t("send.contacts.errors.emptyName"))
      } else if (errorMsg.includes("Payment Identifier is required")) {
        setError(t("send.contacts.errors.emptyPaymentIdentifier"))
      } else { setError(t("send.contacts.errors.somethingWentBad")) }
    }
  }
  
  const handleAddress = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setContact({...contact, paymentIdentifier: e.target.value})
  }

  const handleName = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setContact({...contact, name: e.target.value})
  }


  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  return (
    <>
      {step === "list" && 
        <Modal open={true} onClose={onClose} title={t("send.contacts.title")} headerRight={<AddContactButton onClick={handleAddContact}/>}>
          <div className="flex flex-col gap-3">
            <Input className="h-10" placeholder={t("common.search")} label={t("send.contacts.inputs.search")} onChange={handleSearch}></Input>
            <ContactList handleConfirm={handleConfirm} onClickContact={onClickContact} search={search} handleUpdateContact={handleUpdateContact}/>
          </div>
        </Modal>
      }
      {step === "add" && 
        <Modal open={true} onClose={onClose} title={t("send.contacts.addTitle")}>
            <div className="flex flex-col gap-3">
              <Input className="h-10" label={t("send.contacts.inputs.name")} placeholder={t("send.contacts.inputs.namePlaceholder")} onChange={handleName}></Input>
              <Input className="h-10" label={t("send.contacts.inputs.paymentIdentifier")} placeholder={t("send.contacts.inputs.paymentIdentifierPlaceholder")} onChange={handleAddress}></Input>
              {error && <span className="text-red-500">{error}</span>}
            </div>
            <div className="flex flex-row justify-between, gap-3 mt-6">
              <Button className="flex-1" onClick={() => setStep("list")}>{t("common.cancel")}</Button>
              <Button className="flex-1" onClick={saveContact}>{t("common.save")}</Button>
            </div>
        </Modal>
        }
      {step === "update" && 
      <Modal open={true} onClose={onClose} title={t("send.contacts.updateTitle")} headerRight={<button type="button" onClick={() => setStep("list")}><ContactIcon /></button>}>
        <div className="flex flex-col gap-3">
          <Input value={contact.name} className="h-10" label={t("send.contacts.inputs.name")} placeholder={t("send.contacts.inputs.namePlaceholder")} onChange={handleName}></Input>
          <Input value={contact.paymentIdentifier} className="h-10" label={t("send.contacts.inputs.paymentIdentifier")} placeholder={t("send.contacts.inputs.paymentIdentifierPlaceholder")} onChange={handleAddress}></Input>
          {error && <span className="text-red-500">{error}</span>}
        </div>
        <div className="flex flex-row justify-between gap-3 mt-6">
          <Button className="flex-1" onClick={() => setStep("list")}>{t("common.cancel")}</Button>
          <Button className="flex-1" onClick={saveContact}>{t("common.save")}</Button>
        </div>
      </Modal>}
      {step === "confirm" && 
      <Modal open={true} onClose={onClose} title={t("send.contacts.confirmTitle")} headerRight={<button type="button" onClick={() => setStep("list")}><ContactIcon /></button>}>
        <div className="flex flex-col gap-3">
          <span>{t("send.contacts.deleteConfirm", {name: contact.name})}</span>
        </div>
        <div className="flex flex-row justify-between gap-3 mt-6">
          <Button className="flex-1" onClick={() => setStep("list")}>{t("common.cancel")}</Button>
          <Button className="flex-1" onClick={() => deleteContact(contact)}>{t("common.delete")}</Button>
        </div>
      </Modal>
      }
  </>
  )
}

const ContactList = ({handleConfirm, onClickContact, search, handleUpdateContact}: {handleConfirm: (contact: Contact) => void, search: string, onClickContact: (contact: Contact) => void, handleUpdateContact: (contact: Contact) => void}) => {
  const t = useT()
  const {
    data: contacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContacts(true);

  const bottomRef = useRef<HTMLDivElement>(null);

  let filteredContacts = contacts?.pages.flat().filter((contact) => contact.name.toLowerCase().includes(search.toLowerCase())) || []

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = bottomRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const noMoreContacts = !hasNextPage && filteredContacts.length > 0;
  const message = noMoreContacts ? t("send.contacts.noMoreContacts") : null;

  return (
    <div className="flex flex-col gap-2 max-h-80 overflow-y-scroll">
      {filteredContacts.map((contact) => (
        <ContactItem 
          key={contact.id} 
          onClickContact={onClickContact}
          contact={contact} 
          handleConfirm={handleConfirm} 
          handleUpdateContact={handleUpdateContact}
        />
      ))}
      <div ref={bottomRef} className="py-2 text-center text-xs text-gray-400">
        {isFetchingNextPage
          ? t("send.contacts.loading")
          : message}
      </div>
    </div>
  )
}

const ContactItem = ({contact, handleConfirm, onClickContact, handleUpdateContact}: {contact: Contact, handleConfirm: (contact: Contact) => void, onClickContact: (contact: Contact) => void, handleUpdateContact: (contact: Contact) => void}) => {
  return (
    <div className="flex p-2 flex-row justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors rounded-lg">
      <button type="button" onClick={() => onClickContact(contact)} className="flex flex-col w-full items-start">
        <span>{contact.name}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{contact.paymentIdentifier}</span>
      </button>
      <div className="flex flex-row">
        <button type="button" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={(_) => handleUpdateContact(contact)}>
          <SquarePen className="w-5 h-5"/>
        </button>
        <button type="button" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={() => handleConfirm(contact)}>
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

const ContactElement = ({contact, removeContact}: {contact: Contact, removeContact: () => void}) => {
  const t = useT()
  
  return (
    <>
      <div className="flex flex-col w-full items-start">
      <span>{t("send.contacts.payToContact", {name: contact.name})}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{contact.paymentIdentifier}</span>
      </div>
      <button type="button" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={removeContact}>
        <X className="w-5 h-5" />
      </button>
    </>
  )
}

