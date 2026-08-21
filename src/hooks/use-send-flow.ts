"use client";

import { useState, useEffect, useCallback } from "react";
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
import type { Contact, LnurlPayRequestDetails } from "@breeztech/breez-sdk-spark";
import {
  type PrepareResult,
  describeUnsupported,
  destinationKindForParsed,
  overspends,
  pickLnurlPayDetails,
  readAmountSat,
  readFeeSat,
  sendErrorMessage,
} from "@/lib/wallet/send-helpers";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

export function useSendFlow() {
  const t = useT();
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState("");
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState("");
  const parseMutation = useParseInput();
  const prepareMutation = usePrepareSend();
  const executeMutation = useExecuteSend();
  const prepareLnurlMutation = usePrepareLnurlPay();
  const executeLnurlMutation = useExecuteLnurlPay();

  const { usdRate, totalBalanceSats, isStableBalance } = useSpendableBalance();
  const amount = useAmountInput(usdRate);
  const { resetMaxed } = amount;
  // Shared by typing and by picking a contact; each adds its own extras.
  const setDestinationValue = useCallback(
    (value: string) => {
      setDestination(value);
      resetMaxed();
    },
    [resetMaxed],
  );
  const contacts = useContactSelection(setDestinationValue);



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



  const handleDestinationChange = (value: string) => {
    setDestinationValue(value);
    setError("");
  };

  const handleMax = () => {
    amount.setFromSats(totalBalanceSats);
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

      const amountSat = amount.amountSat;

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
      if (amount.isMaxed() && net > 0 && overspends(prep, totalBalanceSats)) {
        prep = await prepareFor(net);
        if (!prep) return;
      }

      if (overspends(prep, totalBalanceSats)) {
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
    isPreparing:
      prepareMutation.isPending ||
      prepareLnurlMutation.isPending ||
      parseMutation.isPending,
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
