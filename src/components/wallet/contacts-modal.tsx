"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Contact as ContactIcon, SquarePen, Trash2, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useContacts, useContactsAction } from "@/hooks/use-breez";
import { useT } from "@/lib/i18n/hook";
import type { Contact } from "@breeztech/breez-sdk-spark";

const EMPTY: Contact = { name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0 };

const AddContactButton = ({ onClick }: { onClick: () => void }) => {
  const t = useT()  
  return (
      <button aria-label={t("send.contacts.aria.add")} itemID="addContact" type="button" onClick={onClick}>
        <UserRoundPlus className="w-6 h-6" />
      </button>
    )
}

export const ContactsModal = ({ onClose, onClickContact, setContact, contact = EMPTY }: { onClose: () => void, onClickContact: (contact: Contact) => void, setContact: (contact: Contact) => void, contact: Contact | undefined}) => {
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

  const handleDeleteContact = (contact: Contact) => {
    setStep("confirm")
    setContact(contact)
  }

  const confirmDelete = async (contact: Contact) => {
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
      }
      if (step === "update") {
        await contactActions({action: "update", id: contact.id, name: contact.name, paymentIdentifier: contact.paymentIdentifier})
      }
        setStep("list")
        setContact({name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0})
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
            <ContactList handleDeleteContact={handleDeleteContact} onClickContact={onClickContact} search={search} handleUpdateContact={handleUpdateContact}/>
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
            <Button aria-label={t("common.cancel")} className="flex-1" onClick={() => setStep("list")}>{t("common.cancel")}</Button>
            <Button aria-label={t("send.contacts.aria.saveContact", {name: contact.name})} className="flex-1" onClick={saveContact}>{t("common.save")}</Button>
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
        <div aria-label={t("send.contacts.deleteConfirm", {name: contact.name})} className="flex flex-col gap-3">
          <span>{t("send.contacts.deleteConfirm", {name: contact.name})}</span>
        </div>
        <div className="flex flex-row justify-between gap-3 mt-6">
          <Button aria-label={t("common.cancel")} className="flex-1" onClick={() => setStep("list")}>{t("common.cancel")}</Button>
          <Button aria-label={t("send.contacts.confirmDelete", {name: contact.name})} className="flex-1" onClick={() => confirmDelete(contact)}>{t("common.delete")}</Button>
        </div>
      </Modal>
      }
  </>
  )
}

const ContactList = ({handleDeleteContact, onClickContact, search, handleUpdateContact}: {handleDeleteContact: (contact: Contact) => void, search: string, onClickContact: (contact: Contact) => void, handleUpdateContact: (contact: Contact) => void}) => {
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
    <>
      <ul className="flex flex-col gap-2 max-h-80 overflow-y-scroll">
        {filteredContacts.map((contact) => (
          <ContactItem 
            key={contact.id} 
            onClickContact={onClickContact}
            contact={contact} 
            handleDeleteContact={handleDeleteContact} 
            handleUpdateContact={handleUpdateContact}
          />
        ))}
      </ul>
      <div ref={bottomRef} className="py-2 text-center text-xs text-gray-400">
          {isFetchingNextPage
            ? t("send.contacts.loading")
            : message}
      </div>
    </>
  )
}

const ContactItem = ({contact, handleDeleteContact, onClickContact, handleUpdateContact}: {contact: Contact, handleDeleteContact: (contact: Contact) => void, onClickContact: (contact: Contact) => void, handleUpdateContact: (contact: Contact) => void}) => {
  const t = useT()

  return (
    <li aria-labelledby={`contact-${contact.id}`} aria-label={t("send.contacts.payToContact", {name: contact.name})} className="flex p-2 flex-row justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors rounded-lg">
      <button type="button" onClick={() => onClickContact(contact)} className="flex flex-col w-full items-start">
        <span>{contact.name}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{contact.paymentIdentifier}</span>
      </button>
      <div className="flex flex-row">
        <button type="button" aria-label={t("send.contacts.aria.update", {name: contact.name})} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={(_) => handleUpdateContact(contact)}>
          <SquarePen className="w-5 h-5"/>
        </button>
        <button type="button" aria-label={t("send.contacts.aria.delete", {name: contact.name})} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" onClick={() => handleDeleteContact(contact)}>
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </li>
  )
}

export const ContactElement = ({contact, removeContact}: {contact: Contact, removeContact: () => void}) => {
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
