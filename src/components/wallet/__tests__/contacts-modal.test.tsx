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

  it("should render a list of contacts", async () => {
    renderWithProviders(<ContactsModalWrapper />, {
      initialContacts: contactsStore
    });

    const contactsModal = screen.getByRole("dialog", { name: /contacts/i });
    const addContactButton = screen.getByRole("button", { name: /add contact/i });
    const search_contact = screen.getByRole("textbox", { name: /search contact/i });
    const contacts = screen.getAllByRole("listitem");
    
    expect(contactsModal).toBeVisible();
    expect(addContactButton).toBeVisible();
    expect(search_contact).toBeVisible();

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
    
    const initial_contacts = screen.getAllByRole("listitem");
    const search_contact = screen.getByRole("textbox", { name: /search contact/i });

    expect(initial_contacts).toHaveLength(contactsStore.length);
    
    await user.type(search_contact, "test");

    const contacts = screen.getAllByRole("listitem");
    expect(search_contact).toHaveValue("test");
    expect(contacts).toHaveLength(1);
  });

  it("should add a contact", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ContactsModalWrapper />, {
      initialContacts: contactsStore
    });
    
    const addContactButton = screen.getByRole("button", { name: /add contact/i });

    expect(screen.getAllByRole("listitem")).toHaveLength(contactsStore.length);
    
    await user.click(addContactButton);

    const input_name = screen.getByRole("textbox", { name: /name/i });
    const input_payment_identifier = screen.getByRole("textbox", { name: /lightning address/i });
    const save_contact_button = screen.getByRole("button", { name: /save/i });

    expect(input_name).toBeVisible();
    expect(input_payment_identifier).toBeVisible();
    expect(save_contact_button).toBeVisible();

    await user.type(input_name, "Test User");
    await user.type(input_payment_identifier, "test@breez.tips");
    
    expect(input_name).toHaveValue("Test User");
    expect(input_payment_identifier).toHaveValue("test@breez.tips");

    await user.click(save_contact_button);
    
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

    const satoshi_contact = screen.getAllByRole("listitem").filter((c) => c.getAttribute("aria-labelledby") == `contact-${contact.id}`)[0];
    const update_button = within(satoshi_contact).getByRole("button", { name: /update/i });
    
    await user.click(update_button);

    const input_name = screen.getByRole("textbox", { name: /name/i });
    const input_payment_identifier = screen.getByRole("textbox", { name: /lightning address/i });
    const save_contact_button = screen.getByRole("button", { name: /save/i });

    expect(input_name).toBeVisible();
    expect(input_name).toHaveValue(contact.name);
    expect(input_payment_identifier).toBeVisible();
    expect(input_payment_identifier).toHaveValue(contact.paymentIdentifier);
    expect(save_contact_button).toBeVisible();

    await user.clear(input_name);
    await user.type(input_name, "Edited Test User");

    await user.clear(input_payment_identifier);
    await user.type(input_payment_identifier, "edited@breez.tips");
    
    await user.click(save_contact_button);
    
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

    const satoshi_contact = screen.getAllByRole("listitem").filter((c) => c.getAttribute("aria-labelledby") == `contact-${contact.id}`)[0];
    const delete_button = within(satoshi_contact).getByRole("button", { name: /delete contact/i });
    
    await user.click(delete_button);

    const confirm_delete = screen.getByRole("button", { name: /confirm/i });
    
    await user.click(confirm_delete);
    
    await waitFor(() => {
      expect(screen.queryByText(contact.name)).not.toBeInTheDocument();
      expect(screen.queryByText(contact.paymentIdentifier)).not.toBeInTheDocument();
    });
  })
});