import { useQuery } from '@tanstack/react-query';

// ─── GCC Currency Config ──────────────────────────────────────────────────────
export interface GccCurrency {
  code: string;
  name: string;
  symbol: string;
  country: string;
  flag: string;
  decimals: number; // decimal places for display
}

export const GCC_CURRENCIES: GccCurrency[] = [
  { code: 'OMR', name: 'Omani Rial',     symbol: 'OMR', country: 'Oman',        flag: '🇴🇲', decimals: 3 },
  { code: 'SAR', name: 'Saudi Riyal',    symbol: 'SAR', country: 'Saudi Arabia', flag: '🇸🇦', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham',     symbol: 'AED', country: 'UAE',          flag: '🇦🇪', decimals: 2 },
  { code: 'QAR', name: 'Qatari Riyal',   symbol: 'QAR', country: 'Qatar',        flag: '🇶🇦', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar',  symbol: 'KWD', country: 'Kuwait',       flag: '🇰🇼', decimals: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD', country: 'Bahrain',      flag: '🇧🇭', decimals: 3 },
];

export const getCurrencyConfig = (code: string): GccCurrency =>
  GCC_CURRENCIES.find(c => c.code === code) ?? GCC_CURRENCIES[0];

// ─── Format amount with correct currency symbol & decimals ───────────────────
export const formatCurrency = (amount: number, currencyCode: string): string => {
  const cfg = getCurrencyConfig(currencyCode);
  return `${cfg.symbol} ${amount.toFixed(cfg.decimals)}`;
};

// ─── Live Exchange Rates (free, no API key) ───────────────────────────────────
// Uses open.er-api.com — free tier, refreshes daily, no key required.
// Base currency: OMR → rates[SAR] = how many SAR per 1 OMR.
interface ExchangeRateResponse {
  rates: Record<string, number>;
  time_last_update_unix: number;
}

export const useCurrencyRates = () => {
  return useQuery<ExchangeRateResponse>({
    queryKey: ['exchange_rates', 'OMR'],
    queryFn: async (): Promise<ExchangeRateResponse> => {
      const res = await fetch('https://open.er-api.com/v6/latest/OMR');
      if (!res.ok) throw new Error('Failed to fetch exchange rates');
      const data = await res.json();
      return { rates: data.rates, time_last_update_unix: data.time_last_update_unix };
    },
    staleTime: 1000 * 60 * 60 * 6,  // re-fetch after 6 hours
    gcTime:    1000 * 60 * 60 * 24, // keep in cache for 24 hours
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

// ─── Helper: convert OMR amount into another currency ────────────────────────
// rates come from useCurrencyRates (base = OMR)
export const convertFromOMR = (
  amountOMR: number,
  targetCurrency: string,
  rates: Record<string, number> | undefined
): number => {
  if (!rates || targetCurrency === 'OMR') return amountOMR;
  const rate = rates[targetCurrency];
  if (!rate) return amountOMR;
  return amountOMR * rate;
};

// ─── Helper: convert a foreign currency amount back to OMR ──────────────────
export const convertToOMR = (
  amount: number,
  sourceCurrency: string,
  rates: Record<string, number> | undefined
): number => {
  if (!rates || sourceCurrency === 'OMR') return amount;
  const rate = rates[sourceCurrency];
  if (!rate) return amount;
  return amount / rate;
};
