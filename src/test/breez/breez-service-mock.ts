export interface ContactMock {
  id: string;
  name: string;
  paymentIdentifier: string;
  createdAt: number;
  updatedAt: number;
}

export const contactsStore: ContactMock[] = [];

export const setContactsStore = (initialContacts: ContactMock[]) => {
  contactsStore.length = 0;
  contactsStore.push(...initialContacts);
};

export const mockGetContactList = async ({ offset, limit }: { offset: number; limit: number }) => contactsStore.slice(offset, offset + limit);

export const mockAddContact = async (name: string, paymentIdentifier: string) => {
  const newContact: ContactMock = {
    id: String(Date.now()),
    name,
    paymentIdentifier,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  contactsStore.push(newContact);
  return newContact;
};

export const mockUpdateContact = async (id: string, name: string, paymentIdentifier: string) => {
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
};

export const mockDeleteContact = async (id: string) => {
  const index = contactsStore.findIndex((contact) => contact.id === id);
  if (index !== -1) {
    contactsStore.splice(index, 1);
  }
};