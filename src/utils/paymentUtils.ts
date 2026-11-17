import { format } from 'date-fns';

/**
 * Extracts the actual date the payment was received.
 * Checks payment_date column first, then parses notes for [PAYMENT_DATE:YYYY-MM-DD] or [TRANSACTION_DATE:YYYY-MM-DD],
 * and falls back to created_at.
 */
export const getPaymentReceivedDate = (payment: any): { date: string; isExplicit: boolean } => {
  if (payment?.payment_date) {
    return { date: String(payment.payment_date), isExplicit: true };
  }

  if (payment?.notes) {
    const match = String(payment.notes).match(/\[(?:PAYMENT_DATE|TRANSACTION_DATE):\s*([^\]]+)\]/i);
    if (match && match[1]) {
      return { date: match[1].trim(), isExplicit: true };
    }
  }

  if (payment?.created_at) {
    return { date: String(payment.created_at), isExplicit: false };
  }

  return { date: new Date().toISOString(), isExplicit: false };
};

/**
 * Formats the received date for display in UI tables and cards.
 */
export const formatPaymentReceivedDate = (payment: any, pattern: string = 'dd MMM yyyy'): string => {
  const { date } = getPaymentReceivedDate(payment);
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return date;
    return format(parsed, pattern);
  } catch {
    return date;
  }
};

