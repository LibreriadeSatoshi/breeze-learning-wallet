"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { EditPencil, Trash, UserPlus, WarningTriangle, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useContacts, useContactsAction } from "@/hooks/use-breez";
import { useT } from "@/lib/i18n/hook";
import type { Contact } from "@breeztech/breez-sdk-spark";

const EMPTY = { name: "", paymentIdentifier: "", id: "", createdAt: 0, updatedAt: 0 };

const iconButtonClass =
  "inline-flex min-h-control min-w-[44px] flex-none items-center justify-center rounded text-fg transition-colors duration-fast hover:bg-raised";

const FieldError = ({ message }: { message: string }) => (
  <p className="flex items-start gap-2 text-body-sm text-alert">
    <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
    {message}
  </p>
)

const AddContactButton = ({ onClick }: { onClick: () => void }) => {
  const t = useT()  
  return (
      <button aria-label={t("send.contacts.aria.add")} type="button" onClick={onClick} className={`-mr-2 ${iconButtonClass}`}>
        <UserPlus aria-hidden="true" className="h-6 w-6" />
      </button>
    )
}

export const ContactsModal = ({ onClose, onClickContact, setContact, contact = EMPTY }: { onClose: () => void, onClickContact: (contact: Contact) => void, setContact: (contact: Contact) => void, contact: Contact | undefined}) => {
  type ContactStep = "list" | "add" | "update" | "confirm"

  const t = useT()

  const [step, setStep] = useState<ContactStep>("list")
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<"name" | "paymentIdentifier" | null>(null)
  const [search, setSearch] = useState("")
  const { mutateAsync: contactActions } = useContactsAction();

  const clearError = () => {
    setError(null)
    setErrorField(null)
  }

  const handleAddContact = () => {
    clearError()
    setStep("add")
  }

  const handleUpdateContact = (contact: Contact) => {
    clearError()
    setStep("update")
    setContact(contact)
  }

  const handleDeleteContact = (contact: Contact) => {
    clearError()
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
        setErrorField("paymentIdentifier")
        setError(t("send.contacts.errors.invalid"))
      } else if (errorMsg.includes("Name is required")) {
        setErrorField("name")
        setError(t("send.contacts.errors.emptyName"))
      } else if (errorMsg.includes("Payment Identifier is required")) {
        setErrorField("paymentIdentifier")
        setError(t("send.contacts.errors.emptyPaymentIdentifier"))
      } else {
        setErrorField(null)
        setError(t("send.contacts.errors.somethingWentBad"))
      }
    }
  }

  const handleAddress = (e: ChangeEvent<HTMLInputElement>) => {
    clearError()
    setContact({...contact, paymentIdentifier: e.target.value})
  }

  const handleName = (e: ChangeEvent<HTMLInputElement>) => {
    clearError()
    setContact({...contact, name: e.target.value})
  }

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  return (
    <>
      {step === "list" && 
        <Modal open={true} onClose={onClose} title={t("send.contacts.title")} headerRight={<AddContactButton onClick={handleAddContact}/>}>
          <div className="flex flex-col gap-4">
            <Input placeholder={t("common.search")} label={t("send.contacts.inputs.search")} onChange={handleSearch}></Input>
            {error && <FieldError message={error} />}
            <ContactList handleDeleteContact={handleDeleteContact} onClickContact={onClickContact} search={search} handleUpdateContact={handleUpdateContact}/>
          </div>
        </Modal>
      }
      {step === "add" && 
        <Modal open={true} onClose={onClose} title={t("send.contacts.addTitle")}>
          <div className="flex flex-col gap-4">
            <Input label={t("send.contacts.inputs.name")} placeholder={t("send.contacts.inputs.namePlaceholder")} onChange={handleName} error={errorField === "name" && error ? error : undefined}></Input>
            <Input label={t("send.contacts.inputs.paymentIdentifier")} placeholder={t("send.contacts.inputs.paymentIdentifierPlaceholder")} onChange={handleAddress} error={errorField === "paymentIdentifier" && error ? error : undefined}></Input>
            {error && !errorField && <FieldError message={error} />}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { clearError(); setStep("list") }}>{t("common.cancel")}</Button>
            <Button className="flex-1" onClick={saveContact}>{t("common.save")}</Button>
          </div>
        </Modal>
        }
      {step === "update" && 
      <Modal open={true} onClose={onClose} title={t("send.contacts.updateTitle")}>
        <div className="flex flex-col gap-4">
          <Input value={contact.name} label={t("send.contacts.inputs.name")} placeholder={t("send.contacts.inputs.namePlaceholder")} onChange={handleName} error={errorField === "name" && error ? error : undefined}></Input>
          <Input value={contact.paymentIdentifier} label={t("send.contacts.inputs.paymentIdentifier")} placeholder={t("send.contacts.inputs.paymentIdentifierPlaceholder")} onChange={handleAddress} error={errorField === "paymentIdentifier" && error ? error : undefined}></Input>
          {error && !errorField && <FieldError message={error} />}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => { clearError(); setStep("list") }}>{t("common.cancel")}</Button>
          <Button className="flex-1" onClick={saveContact}>{t("common.save")}</Button>
        </div>
      </Modal>}
      {step === "confirm" && 
      <Modal open={true} onClose={onClose} title={t("send.contacts.confirmTitle")}>
        <p className="text-body">{t("send.contacts.confirmDelete", {name: contact.name})}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => { clearError(); setStep("list") }}>{t("common.cancel")}</Button>
          <Button className="flex-1" onClick={() => confirmDelete(contact)}>{t("common.delete")}</Button>
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
      {filteredContacts.length > 0 && (
        <ul className="-mx-2 max-h-80 divide-y divide-hairline overflow-y-auto border-y border-hairline">
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
      )}
      <div ref={bottomRef} className="py-2 text-center text-caption text-fg-muted">
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
    <li className="flex items-center gap-2 py-1">
      <button type="button" onClick={() => onClickContact(contact)} className="flex min-h-control min-w-0 flex-1 flex-col items-start rounded px-2 text-left transition-colors duration-fast hover:bg-raised">
        <span className="text-body text-fg">{contact.name}</span>
        <span className="w-full truncate font-mono text-caption text-fg-muted">{contact.paymentIdentifier}</span>
      </button>
      <div className="flex flex-none">
        <button type="button" aria-label={t("send.contacts.aria.update", {name: contact.name})} className={iconButtonClass} onClick={(_) => handleUpdateContact(contact)}>
          <EditPencil aria-hidden="true" className="h-5 w-5"/>
        </button>
        <button type="button" aria-label={t("send.contacts.aria.delete", {name: contact.name})} className={iconButtonClass} onClick={() => handleDeleteContact(contact)}>
          <Trash aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </li>
  )
}

export const ContactElement = ({contact, removeContact}: {contact: Contact, removeContact: () => void}) => {
  const t = useT()
  
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col items-start py-1">
        <span className="text-body text-fg">{t("send.contacts.payToContact", {name: contact.name})}</span>
        <span className="w-full truncate font-mono text-caption text-fg-muted">{contact.paymentIdentifier}</span>
      </div>
      <button type="button" className={`-mr-2 ${iconButtonClass}`} onClick={removeContact} aria-label={t("send.contacts.remove", { name: contact.name })}>
        <Xmark aria-hidden="true" className="h-5 w-5" />
      </button>
    </>
  )
}
