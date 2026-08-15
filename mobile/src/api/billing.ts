import { api } from './client';

export interface Invoice {
  id: string;
  date: string;
  amount: string;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  pdf_url?: string;
}

export interface Subscription {
  tier: 'free' | 'premium';
  status: 'active' | 'canceled' | 'past_due';
  current_period_end?: string;
  payment_method?: {
    brand: string;
    last4: string;
  };
}

export async function getSubscription(): Promise<Subscription> {
  return api.get<Subscription>('/me/subscription');
}

export async function listInvoices(): Promise<Invoice[]> {
  return api.get<Invoice[]>('/me/invoices');
}

export async function cancelSubscription(): Promise<{ status: string }> {
  return api.post<{ status: string }>('/me/subscription/cancel');
}
