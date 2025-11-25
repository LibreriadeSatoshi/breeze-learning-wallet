interface InvoiceData {
  amountMsat?: number;
  description?: string;
  payee?: string;
  timestamp?: number;
  expiry?: number;
  paymentHash?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function parseInvoice(invoice: string): InvoiceData | null {
  try {
    const cleaned = invoice.trim().toLowerCase();
    
    if (!cleaned.startsWith('lnbc') && !cleaned.startsWith('lntb') && !cleaned.startsWith('lnbcrt')) {
      return null;
    }

    const data: InvoiceData = {
      timestamp: Date.now(),
      expiry: 3600,
    };

    const match = cleaned.match(/^ln(bc|tb|bcrt)(\d+)([munp]?)/);
    if (match) {
      const [, , amountStr, multiplier] = match;
      const amount = parseInt(amountStr, 10);
      
      if (!isNaN(amount) && amount > 0) {
        let multiplierValue = 1;
        switch (multiplier) {
          case 'm':
            multiplierValue = 100000000;
            break;
          case 'u':
            multiplierValue = 100000;
            break;
          case 'n':
            multiplierValue = 100;
            break;
          case 'p':
            multiplierValue = 0.1;
            break;
          default:
            multiplierValue = 100000000000;
        }
        
        data.amountMsat = amount * multiplierValue;
      }
    }

    data.description = 'Lightning payment';

    return data;
  } catch (error) {
    console.error('Failed to parse invoice:', error);
    return null;
  }
}

export function validateInvoice(invoice: string): ValidationResult {
  const cleaned = invoice.trim().toLowerCase();

  if (!cleaned) {
    return { valid: false, error: 'Please enter an invoice or address' };
  }

  if (cleaned.length < 10) {
    return { valid: false, error: 'Invalid invoice format' };
  }

  if (cleaned.startsWith('lnbc') || cleaned.startsWith('lntb') || cleaned.startsWith('lnbcrt')) {
    if (cleaned.length < 20) {
      return { valid: false, error: 'Invoice too short' };
    }
    
    const validChars = /^[a-z0-9]+$/;
    if (!validChars.test(cleaned)) {
      return { valid: false, error: 'Invoice contains invalid characters' };
    }

    return { valid: true };
  }

  if (cleaned.startsWith('bc1') || cleaned.startsWith('tb1') || cleaned.startsWith('bcrt1')) {
    if (cleaned.length < 14 || cleaned.length > 90) {
      return { valid: false, error: 'Invalid address length' };
    }
    
    const validChars = /^[a-z0-9]+$/;
    if (!validChars.test(cleaned)) {
      return { valid: false, error: 'Address contains invalid characters' };
    }

    return { valid: true };
  }

  if (cleaned.match(/^[13]/)) {
    if (cleaned.length < 26 || cleaned.length > 35) {
      return { valid: false, error: 'Invalid address length' };
    }
    
    const validChars = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    if (!validChars.test(cleaned)) {
      return { valid: false, error: 'Address contains invalid characters' };
    }

    return { valid: true };
  }

  return { valid: false, error: 'Invalid invoice or address format' };
}

export function isInvoiceExpired(invoiceData: InvoiceData): boolean {
  if (!invoiceData.timestamp || !invoiceData.expiry) {
    return false;
  }

  const expiryTime = invoiceData.timestamp + (invoiceData.expiry * 1000);
  return Date.now() > expiryTime;
}

export function msatToSat(msat: number): number {
  return Math.floor(msat / 1000);
}

export function satToMsat(sat: number): number {
  return sat * 1000;
}

export function satToBtc(sat: number): number {
  return sat / 100000000;
}

export function btcToSat(btc: number): number {
  return Math.floor(btc * 100000000);
}

export function shortenInvoice(invoice: string, length: number = 20): string {
  if (invoice.length <= length) return invoice;
  const start = Math.floor(length / 2);
  const end = Math.ceil(length / 2);
  return `${invoice.slice(0, start)}...${invoice.slice(-end)}`;
}

