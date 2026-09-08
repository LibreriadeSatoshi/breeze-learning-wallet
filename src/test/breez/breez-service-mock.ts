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

export interface Rate {
  coin: string;
  value: number;
}

const fiatRates: Rate[] = [{
    coin: "USD",
    value: 78000,
  }, {
    coin: "EUR",
    value: 67000,
}];

export const mockListFiatRates = () => fiatRates; 
export interface LightningAddress {
  description: string;
  lightningAddress: string;
  lnurl: {
      url: string;
      bech32: string;
  };
  username: string;
}

const INITIAL_LIGHTNING_ADDRESSES: LightningAddress[] = [
  {
    description: "Pay to satoshi@pay.santiagobitdevs.org",
    lightningAddress: "satoshi@pay.santiagobitdevs.org",
    lnurl: {
      url: "lnurlp://pay.santiagobitdevs.org/lnurlp/satoshi",
      bech32: "lnurl1dp68gurn8ghj7urp0yh8xctww35kzem0vf5hger9weejummjvuhkcmn4wfk8qtm5v4ehgvssmnnfx"
    },
    username: "satoshi"
  },
  {
    description: "Pay to dorchestra@pay.santiagobitdevs.org",
    lightningAddress: "dorchestra@pay.santiagobitdevs.org",
    lnurl: {
      url: "lnurlp://pay.santiagobitdevs.org/lnurlp/dorchestra",
      bech32: "lnurl1dp68gurn8ghj7urp0yh8xctww35kzem0vf5hger9weejummjvuhkcmn4wfk8qtm5v4ehgvssmnnfx"
    },
    username: "dorchestra"
  },
  {
    description: "Pay to devs@pay.santiagobitdevs.org",
    lightningAddress: "devs@pay.santiagobitdevs.org",
    lnurl: {
      url: "lnurlp://pay.santiagobitdevs.org/lnurlp/devs",
      bech32: "lnurl1dp68gurn8ghj7urp0yh8xctww35kzem0vf5hger9weejummjvuhkcmn4wfk8qtm5v4ehgvssmnnfx"
    },
    username: "devs"
  },
];

const lightningAddresses: Set<LightningAddress> = new Set<LightningAddress>(INITIAL_LIGHTNING_ADDRESSES);

export const mockCheckLightningAddressAvailable = async (username: string) => {
  const target = username.trim().toLowerCase();

  const exists = Array.from(lightningAddresses.values()).some(
    (address) => address.username.toLowerCase() === target
  );

  return !exists;
};

export const mockRegisterLightningAddress = async (
  username: string,
  description?: string,
) => {
  const normalized = username.trim().toLowerCase();

  const newAddress = {
    description: description || username,
    lightningAddress: `${normalized}@pay.santiagobitdevs.org`,
    lnurl: {
      url: `lnurlp://pay.santiagobitdevs.org/lnurlp/${normalized}`,
      bech32: "lnurl1dp68gurn8ghj7urp0yh8xctww35kzem0vf5hger9weejummjvuhkcmn4wfk8qtm5v4ehgvssmnnfx"
    },
    username: normalized,
    };
    
    lightningAddresses.add(newAddress);

    return newAddress
}

export const resetLightningAddress = () => {
  lightningAddresses.clear();
  INITIAL_LIGHTNING_ADDRESSES.forEach((address) => lightningAddresses.add({...address}));
}

export const mockGetLightningAddress = () => {
  let addresses: LightningAddress = Array.from(lightningAddresses.values())[0];

  return addresses ?? null;
}

export const mockReceiveLightning = async (
  amountSats: number,
  description: string,
): Promise<{ paymentRequest: string; expiresAt: number; fee: number }> => {
  return {
    paymentRequest: "lnurl1dp68gurn8ghj7urp0yh8xctww35kzem0vf5hger9weejummjvuhkcmn4wfk8qtm5v4ehgvssmnnfx",
    fee: 0,
    expiresAt: 1000
  }
}
