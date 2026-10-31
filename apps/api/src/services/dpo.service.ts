const DPO_API_URL = 'https://secure.3gdirectpay.com/API/v6/';

export type DpoMobileProvider = 'AIRTEL_MONEY' | 'MTN_MOMO';

export interface DpoPaymentRequest {
  amount: number;
  phone: string;
  provider: DpoMobileProvider;
  companyReference: string;
  country?: string;
  currency?: string;
  mno?: string;
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function field(xml: string, name: string): string | undefined {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeXml(match[1].replace(/^<!\\[CDATA\\[|\\]\\]>$/g, '')) : undefined;
}

function responseCode(xml: string): string | undefined {
  return field(xml, 'Result') || field(xml, 'Code');
}

function responseExplanation(xml: string): string {
  return field(xml, 'ResultExplanation') || field(xml, 'Explanation') || 'DPO returned an unknown response.';
}

function sanitizeRedirectUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Reject malformed URLs
  }
  return undefined;
}

export class DpoService {
  private get companyToken(): string {
    return (process.env.DPO_COMPANY_TOKEN || '').trim();
  }

  private get apiUrl(): string {
    const configured = (process.env.DPO_API_URL || DPO_API_URL).trim();
    if (!configured.startsWith('https://')) {
      throw new Error('Security policy violation: DPO_API_URL must use HTTPS.');
    }
    return configured;
  }

  private get mnoCountry(): string {
    return process.env.DPO_MNO_COUNTRY || 'Zambia';
  }

  private mnoFor(provider: DpoMobileProvider): string {
    return provider === 'AIRTEL_MONEY'
      ? process.env.DPO_AIRTEL_MNO || 'Airtel'
      : process.env.DPO_MTN_MNO || 'MTN';
  }

  private async send(xml: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          Accept: 'application/xml'
        },
        body: xml,
        signal: controller.signal
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`DPO request failed with HTTP ${response.status}.`);
      }
      return body;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('DPO payment gateway request timed out after 15 seconds.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private requireConfiguration(): void {
    if (!this.companyToken) {
      throw new Error('DPO is not configured. Set DPO_COMPANY_TOKEN on the API server before requesting mobile money payments.');
    }
  }

  async requestMobilePayment(input: DpoPaymentRequest) {
    this.requireConfiguration();
    const mno = input.mno || this.mnoFor(input.provider);
    const country = input.country || this.mnoCountry;
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('A valid payment amount is required.');

    const now = new Date();
    const serviceDate = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const createTokenXml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(this.companyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${xmlEscape(input.currency || process.env.DPO_CURRENCY || 'ZMW')}</PaymentCurrency>
    <CompanyRef>${xmlEscape(input.companyReference)}</CompanyRef>
    <CompanyRefUnique>1</CompanyRefUnique>
    <PTL>15</PTL>
    <PTLtype>minutes</PTLtype>
    <DefaultPayment>MO</DefaultPayment>
    <DefaultPaymentCountry>${xmlEscape(country)}</DefaultPaymentCountry>
    <DefaultPaymentMNO>${xmlEscape(mno)}</DefaultPaymentMNO>
    <TransactionSource>POS</TransactionSource>
  </Transaction>
  <Services>
    <Service>
      <ServiceTypeName>${xmlEscape(process.env.DPO_SERVICE_TYPE_NAME || 'Restaurant')}</ServiceTypeName>
      <ServiceDescription>${xmlEscape(`LSpot POS order ${input.companyReference}`)}</ServiceDescription>
      <ServiceDate>${serviceDate}</ServiceDate>
    </Service>
  </Services>
</API3G>`;
    const createdXml = await this.send(createTokenXml);
    if (responseCode(createdXml) !== '000') throw new Error(`DPO could not create payment: ${responseExplanation(createdXml)}`);
    const transactionToken = field(createdXml, 'TransToken');
    if (!transactionToken) throw new Error('DPO did not return a transaction token.');

    const chargeXml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(this.companyToken)}</CompanyToken>
  <Request>ChargeTokenMobile</Request>
  <TransactionToken>${xmlEscape(transactionToken)}</TransactionToken>
  <PhoneNumber>${xmlEscape(input.phone)}</PhoneNumber>
  <MNO>${xmlEscape(mno)}</MNO>
  <MNOcountry>${xmlEscape(country)}</MNOcountry>
</API3G>`;
    const chargedXml = await this.send(chargeXml);
    const code = responseCode(chargedXml);
    if (code !== '000' && code !== '0130' && code !== '130') {
      throw new Error(`DPO could not send the mobile-money request: ${responseExplanation(chargedXml)}`);
    }

    return {
      transactionToken,
      transactionRef: field(createdXml, 'TransRef') || input.companyReference,
      instructions: field(chargedXml, 'Instructions') || 'Approve the payment request on the customer’s phone.',
      redirectUrl: sanitizeRedirectUrl(field(chargedXml, 'RedirectUrl')),
      redirectOption: field(chargedXml, 'RedirectOption'),
      mobileRequestStatus: field(chargedXml, 'MobilePaymentRequest') || 'PENDING'
    };
  }

  async verifyMobilePayment(transactionToken: string) {
    this.requireConfiguration();
    if (!/^[A-Za-z0-9-]{6,128}$/.test(transactionToken)) {
      throw new Error('Invalid DPO transaction token format.');
    }
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(this.companyToken)}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${xmlEscape(transactionToken)}</TransactionToken>
  <VerifyTransaction>0</VerifyTransaction>
</API3G>`;
    const body = await this.send(xml);
    const code = responseCode(body) || '900';
    return {
      code,
      status: code === '000' ? 'PAID' : code === '001' ? 'AUTHORIZED' : code === '900' || code === '003' || code === '005' ? 'PENDING' : 'FAILED',
      explanation: responseExplanation(body),
      transactionReference: field(body, 'TransactionRef') || field(body, 'TransactionApproval'),
      companyReference: field(body, 'CompanyRef'),
      transactionAmount: Number(field(body, 'TransactionAmount') || 0),
      transactionCurrency: field(body, 'TransactionCurrency') || 'ZMW',
      mobileRequestStatus: field(body, 'MobilePaymentRequest')
    };
  }
}

export const dpoService = new DpoService();
