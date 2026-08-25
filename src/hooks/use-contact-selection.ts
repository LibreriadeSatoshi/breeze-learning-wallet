"use client";

import { useCallback, useState } from "react";
import type { Contact } from "@breeztech/breez-sdk-spark";

const EMPTY: Contact = { name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0 };

/** Picking a saved contact as a payment destination. */
export function useContactSelection(onDestinationChange: (value: string) => void) {
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [isSelected, setIsSelected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const select = useCallback(
    (picked: Contact) => {
      setContact(picked);
      setIsSelected(true);
      setIsModalOpen(false);
      onDestinationChange(picked.paymentIdentifier);
    },
    [onDestinationChange],
  );

  const clear = useCallback(() => {
    setContact(EMPTY);
    setIsSelected(false);
    onDestinationChange("");
  }, [onDestinationChange]);

  return { contact, setContact, isSelected, isModalOpen, setIsModalOpen, select, clear };
}
