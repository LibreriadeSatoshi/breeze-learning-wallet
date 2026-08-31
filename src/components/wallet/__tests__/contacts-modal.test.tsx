import userEvent from '@testing-library/user-event';
import { renderWithProviders,  screen, waitFor, within } from "@/test/test-utils";
import { ContactsModal } from '../contacts-modal';
import { Contact } from '@breeztech/breez-sdk-spark/web';
import { useState } from 'react';

const onClose = vi.fn();
const onClickContact = vi.fn();

const mockContacts = [
  { id: "1", name: "Satoshi Nakamoto", paymentIdentifier: "satoshi@breez.tips", createdAt: 0, updatedAt: 0 },
  { id: "2", name: "Tester Nakamoto", paymentIdentifier: "tester@breez.tips", createdAt: 0, updatedAt: 0 },
  { id: "3", name: "Alice", paymentIdentifier: "alice@breez.tips", createdAt: 0, updatedAt: 0 },
];

let contactsStore: typeof mockContacts = [];

vi.mock("@/lib/lightning/breez-service", () => ({
  listContacts: vi.fn().mockImplementation(async () => {
    return contactsStore;
  }),
  addContact: vi.fn().mockImplementation(async (name, paymentIdentifier) => {
    const newContact = {
      id: String(Date.now()),
      name,
      paymentIdentifier,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    contactsStore.push(newContact);
    return newContact;
  }),
  updateContact: vi.fn().mockImplementation(async (id, name, paymentIdentifier) => {
    const index = contactsStore.findIndex((c) => c.id === id);
    if (index !== -1) {
      contactsStore[index] = {
        ...contactsStore[index],
        name,
        paymentIdentifier,
        updatedAt: Date.now(),
      };
      return contactsStore[index];
    }
  }),
  deleteContact: vi.fn().mockImplementation(async (id) => {
    const index = contactsStore.findIndex((contact) => contact.id === id);
    if (index !== -1) {
      contactsStore.splice(index, 1);
    }
  }),
}));

const ContactsModalWrapper = ({ initialContact = undefined }: { initialContact?: Contact }) => {
  const [contact, setContact] = useState<Contact | undefined>(initialContact);
  
  return (
    <ContactsModal 
      onClose={onClose} 
      onClickContact={onClickContact} 
      setContact={setContact as (c: Contact) => void} 
      contact={contact as Contact} 
    />
  );
};

describe("ContactsModal", () => {
  beforeEach(() => {
    contactsStore = [...mockContacts];
  });

  it("should render a list of contacts", () => {
    renderWithProviders(<ContactsModalWrapper />, {
      initialContacts: contactsStore
    });

    const contactsModal = screen.getByRole("dialog", { name: /contacts/i });
    const addContactButton = screen.getByRole("button", { name: /add new contact/i });
    const searchContact = screen.getByRole("textbox", { name: /search contact/i });
    const contacts = screen.getAllByRole("listitem");
    
    expect(contactsModal).toBeVisible();
    expect(addContactButton).toBeVisible();
    expect(searchContact).toBeVisible();

    contactsStore.forEach((contact) => {
      expect(screen.getByText(contact.name)).toBeInTheDocument();
      expect(screen.getByText(contact.paymentIdentifier)).toBeInTheDocument();
    });
    expect(contacts).toHaveLength(contactsStore.length);
  });

  it("should filter contacts", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ContactsModalWrapper />, {
      initialContacts: contactsStore
    });
    
    const initialContacts = screen.getAllByRole("listitem");
    const searchContact = screen.getByRole("textbox", { name: /search contact/i });

    expect(initialContacts).toHaveLength(contactsStore.length);
    
    await user.type(searchContact, "test");

    const contacts = screen.getAllByRole("listitem");
    expect(searchContact).toHaveValue("test");
    expect(contacts).toHaveLength(1);
  });

  it("should add a contact", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ContactsModalWrapper />, {
      initialContacts: contactsStore
    });
    
    const addContactButton = screen.getByRole("button", { name: /add new contact/i });

    expect(screen.getAllByRole("listitem")).toHaveLength(contactsStore.length);
    
    await user.click(addContactButton);

    const inputName = screen.getByRole("textbox", { name: /name/i });
    const inputPaymentIdentifier = screen.getByRole("textbox", { name: /lightning address/i });
    const saveContactButton = screen.getByRole("button", { name: /save/i });

    expect(inputName).toBeVisible();
    expect(inputPaymentIdentifier).toBeVisible();
    expect(saveContactButton).toBeVisible();

    await user.type(inputName, "Test User");
    await user.type(inputPaymentIdentifier, "test@breez.tips");
    
    expect(inputName).toHaveValue("Test User");
    expect(inputPaymentIdentifier).toHaveValue("test@breez.tips");

    await user.click(saveContactButton);
    
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });

  it("should update a contact", async () => {
    const user = userEvent.setup();
    const contact = contactsStore[0];

    renderWithProviders(<ContactsModalWrapper initialContact={contactsStore[0]} />, {
      initialContacts: contactsStore
    });    

    const satoshiContact = screen.getAllByRole("listitem").find((c) => c.getAttribute("aria-labelledby") == `contact-${contact.id}`)!;
    const updateButton = within(satoshiContact).getByRole("button", { name: /update/i });
    
    await user.click(updateButton);

    const inputName = screen.getByRole("textbox", { name: /name/i });
    const inputPaymentIdentifier = screen.getByRole("textbox", { name: /lightning address/i });
    const saveContactButton = screen.getByRole("button", { name: /save/i });

    expect(inputName).toBeVisible();
    expect(inputName).toHaveValue(contact.name);
    expect(inputPaymentIdentifier).toBeVisible();
    expect(inputPaymentIdentifier).toHaveValue(contact.paymentIdentifier);
    expect(saveContactButton).toBeVisible();

    await user.clear(inputName);
    await user.type(inputName, "Edited Test User");

    await user.clear(inputPaymentIdentifier);
    await user.type(inputPaymentIdentifier, "edited@breez.tips");
    
    await user.click(saveContactButton);
    
    await waitFor(() => {
    expect(screen.getByText("Edited Test User")).toBeInTheDocument();
    expect(screen.getByText("edited@breez.tips")).toBeInTheDocument();
    });
  });
  it("should delete a contact", async () => {
    const user = userEvent.setup();
    const contact = contactsStore[0]

    renderWithProviders(<ContactsModalWrapper initialContact={contact} />, {
      initialContacts: contactsStore
    });    

    const satoshiContact = screen.getAllByRole("listitem").find((c) => c.getAttribute("aria-labelledby") == `contact-${contact.id}`)!;
    const deleteButton = within(satoshiContact).getByRole("button", { name: /delete contact/i });
    
    await user.click(deleteButton);

    const confirmDelete = screen.getByRole("button", { name: /confirm/i });
    
    await user.click(confirmDelete);
    
    await waitFor(() => {
      expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
      expect(screen.queryByText(contact.paymentIdentifier)).not.toBeInTheDocument();
    });
  })
});