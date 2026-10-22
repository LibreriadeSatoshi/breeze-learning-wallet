"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWalletStore } from "@/store/wallet-store";
import {
  useParseInput,
  usePrepareSend,
  useExecuteSend,
  usePrepareLnurlPay,
  useExecuteLnurlPay,
} from "@/hooks/use-breez";
import { useAmountInput } from "@/hooks/use-amount-input";
import { useContactSelection } from "@/hooks/use-contact-selection";
import { useSpendableBalance } from "@/hooks/use-spendable-balance";
import { useT } from "@/lib/i18n/hook";
import type { Contact, InputType, LnurlPayRequestDetails } from "@breeztech/breez-sdk-spark";
import {
  type PrepareResult,
  describeUnsupported,
  destinationKindForParsed,
  isOtherNetwork,
  overspends,
  pickBip21Method,
  pickLnurlPayDetails,
  readAmountSat,
  readFeeSat,
  sendErrorMessage,
} from "@/lib/wallet/send-helpers";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

const SUCCESS_REDIRECT_MS = 2000;

interface ResolvedDestination {
  dest: string;
  parsed: InputType;
  amountSat?: number;
  memo?: string;
}

export function useSendFlow() {
  const t = useT();
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState("");
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState("");
  const [isMaxing, setIsMaxing] = useState(false);
  const parseMutation = useParseInput();
  const prepareMutation = usePrepareSend();
  const executeMutation = useExecuteSend();
  const prepareLnurlMutation = usePrepareLnurlPay();
  const executeLnurlMutation = useExecuteLnurlPay();

  const { usdRate, totalBalanceSats, isStableBalance } = useSpendableBalance();
  const amount = useAmountInput(usdRate);
  const contacts = useContactSelection(setDestination);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  // Tied to the success screen, so leaving it first cancels the redirect.
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => router.push("/wallet/home"), SUCCESS_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [step, router]);

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

  const handleDestinationChange = (value: string) => {
    setDestination(value);
    setError("");
  };

  const preparePayment = async (
    { parsed, dest, memo }: ResolvedDestination,
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
      memo,
    };
  };

  const resolveDestination = async (): Promise<ResolvedDestination | null> => {
    const raw = destination.trim();
    if (!raw) {
      setError(t("send.destinationRequired"));
      return null;
    }
    let resolved: ResolvedDestination = { dest: raw, parsed: await parseMutation.mutateAsync(raw) };
    if (resolved.parsed.type === "bip21") {
      const bip21 = resolved.parsed;
      const method = pickBip21Method(bip21);
      if (!method) {
        setError(t("send.unsupported.bip21"));
        return null;
      }
      resolved = {
        dest: method.input,
        parsed: method.parsed,
        amountSat: bip21.amountSat,
        memo: bip21.message ?? bip21.label,
      };
    }
    const unsupported = describeUnsupported(resolved.parsed, t);
    if (unsupported) {
      setError(unsupported);
      return null;
    }
    if (isOtherNetwork(resolved.parsed)) {
      setError(t("send.errors.wrongNetwork"));
      return null;
    }
    return resolved;
  };

  const handleMax = async () => {
    setError("");
    setIsMaxing(true);
    try {
      const resolved = await resolveDestination();
      if (!resolved) return;

      const prep = await preparePayment(resolved, totalBalanceSats);
      if (!prep) return;

      const prepared = readAmountSat(prep);
      if (prepared !== null && prepared !== totalBalanceSats) return;

      const net = totalBalanceSats - readFeeSat(prep);
      if (net <= 0) {
        setError(t("send.insufficientBalance", { balance: (0).toLocaleString() }));
        return;
      }
      amount.setFromSats(net);
    } catch (err) {
      setError(sendErrorMessage(err, t, "send.genericError"));
    } finally {
      setIsMaxing(false);
    }
  };

  const handleContinue = async () => {
    setError("");
    try {
      const resolved = await resolveDestination();
      if (!resolved) return;

      // A payment link's amount fills in for an empty field, and shows there.
      const amountSat = amount.amountSat ?? resolved.amountSat;
      if (amount.amountSat === undefined && resolved.amountSat !== undefined) {
        amount.setFromSats(resolved.amountSat);
      }
      const prep = await preparePayment(resolved, amountSat);
      if (!prep) return;

      if (overspends(prep, totalBalanceSats)) {
        const net = totalBalanceSats - readFeeSat(prep);
        setError(
          t("send.insufficientBalance", {
            balance: Math.max(0, net).toLocaleString(),
          }),
        );
        return;
      }
      setPrepareResult(prep);
      setStep("confirm");
    } catch (err) {
      setError(sendErrorMessage(err, t, "send.genericError"));
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
    amount.clear();
    setPrepareResult(null);
  };

  return {
    isUnlocked,
    step,
    destination,
    inputValue: amount.value,
    isSats: amount.isSats,
    prepareResult,
    error,
    contact: contacts.contact,
    showContactsModal: contacts.isModalOpen,
    isContactSelected: contacts.isSelected,
    usdRate,
    totalBalanceSats,
    isStableBalance,
    isMaxing,
    isPreparing:
      !isMaxing &&
      (prepareMutation.isPending ||
        prepareLnurlMutation.isPending ||
        parseMutation.isPending),
    isSending: executeMutation.isPending || executeLnurlMutation.isPending,
    handleDestinationChange,
    setShowContactsModal: contacts.setIsModalOpen,
    setContact: contacts.setContact,
    handlePaste,
    handleMax,
    handleContinue,
    handleConfirmPayment,
    handleBack,
    handleRetry,
    handleAmountInput: amount.handleChange,
    toggleIsSats: amount.toggleUnit,
    onClickContact: (picked: Contact) => {
      contacts.select(picked);
      setStep("input");
    },
    handleRemoveContact: contacts.clear,
    goHome: () => router.push("/wallet/home"),
  };
}
