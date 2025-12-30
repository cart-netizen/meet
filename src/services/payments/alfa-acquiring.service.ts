/**
 * Alfa-Bank Acquiring Service
 * Payment processing integration with Alfa-Bank
 *
 * STUB IMPLEMENTATION - Replace with real API calls in production
 *
 * Alfa-Bank Acquiring API documentation:
 * https://pay.alfabank.ru/ecommerce/instructions/merchantManual/
 */

import { supabase } from '@/services/supabase/client';
import type { Payment, SubscriptionType } from '@/types';
import { SUBSCRIPTION_CONFIG } from '@/constants';

// ============================================================================
// Configuration
// ============================================================================

const ALFA_API_URL = process.env.EXPO_PUBLIC_ALFA_API_URL ?? 'https://pay.alfabank.ru/payment';
const ALFA_MERCHANT_LOGIN = process.env.EXPO_PUBLIC_ALFA_MERCHANT_LOGIN ?? '';
const ALFA_RETURN_URL = process.env.EXPO_PUBLIC_ALFA_RETURN_URL ?? 'meetup://payment/callback';
const ALFA_FAIL_URL = process.env.EXPO_PUBLIC_ALFA_FAIL_URL ?? 'meetup://payment/failed';

// ============================================================================
// Types
// ============================================================================

export interface CreatePaymentParams {
  amount: number; // in kopecks (1 ruble = 100 kopecks)
  orderNumber: string;
  description: string;
  returnUrl?: string;
  failUrl?: string;
  clientId?: string;
  email?: string;
  phone?: string;
  features?: 'AUTO_PAYMENT' | 'VERIFY';
}

export interface PaymentResult {
  orderId: string;
  formUrl: string;
}

export interface PaymentStatus {
  orderStatus: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  orderNumber: string;
  amount: number;
  errorCode: string;
  errorMessage: string;
  actionCode: number;
  actionCodeDescription: string;
  depositAmount: number;
  bindingInfo?: {
    clientId: string;
    bindingId: string;
  };
}

export interface BindingInfo {
  bindingId: string;
  maskedPan: string;
  expiryDate: string;
  clientId: string;
}

export interface RecurringPaymentParams {
  bindingId: string;
  amount: number;
  orderNumber: string;
  description: string;
}

// ============================================================================
// Payment Order Status Codes
// ============================================================================

export const ORDER_STATUS = {
  REGISTERED: 0,        // Заказ зарегистрирован, но не оплачен
  PREAUTHORIZED: 1,     // Предавторизованная сумма захолдирована
  AUTHORIZED: 2,        // Проведена полная авторизация суммы заказа
  CANCELLED: 3,         // Авторизация отменена
  REFUNDED: 4,          // По транзакции была проведена операция возврата
  ACS_AUTH: 5,          // Инициирована авторизация через ACS банка-эмитента
  AUTH_DECLINED: 6,     // Авторизация отклонена
} as const;

// ============================================================================
// STUB: Mock Responses
// ============================================================================

const STUB_MODE = !ALFA_MERCHANT_LOGIN;

function generateStubOrderId(): string {
  return `stub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Payment Operations
// ============================================================================

/**
 * Create a new payment order
 * Returns URL for payment form redirect
 */
export async function createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const {
    amount,
    orderNumber,
    description,
    returnUrl = ALFA_RETURN_URL,
    failUrl = ALFA_FAIL_URL,
    clientId,
    email,
    phone,
    features,
  } = params;

  // STUB MODE
  if (STUB_MODE) {
    console.log('[STUB] Creating payment:', { amount, orderNumber, description });
    const orderId = generateStubOrderId();
    return {
      orderId,
      formUrl: `https://pay.alfabank.ru/stub?orderId=${orderId}&amount=${amount}`,
    };
  }

  // Build request params
  const requestParams = new URLSearchParams({
    userName: ALFA_MERCHANT_LOGIN,
    password: process.env.EXPO_PUBLIC_ALFA_MERCHANT_PASSWORD ?? '',
    orderNumber,
    amount: amount.toString(),
    returnUrl,
    failUrl,
    description,
  });

  if (clientId) {
    requestParams.append('clientId', clientId);
  }

  if (email) {
    requestParams.append('email', email);
  }

  if (phone) {
    requestParams.append('phone', phone);
  }

  if (features) {
    requestParams.append('features', features);
  }

  // Call Alfa-Bank API
  const response = await fetch(`${ALFA_API_URL}/rest/register.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams.toString(),
  });

  const data = await response.json();

  if (data.errorCode) {
    throw new Error(`Payment creation failed: ${data.errorMessage}`);
  }

  return {
    orderId: data.orderId,
    formUrl: data.formUrl,
  };
}

/**
 * Check payment status
 */
export async function getPaymentStatus(orderId: string): Promise<PaymentStatus> {
  // STUB MODE
  if (STUB_MODE) {
    console.log('[STUB] Getting payment status:', orderId);
    // Simulate successful payment for stubs
    return {
      orderStatus: ORDER_STATUS.AUTHORIZED,
      orderNumber: `order_${Date.now()}`,
      amount: 19900, // 199 rubles in kopecks
      errorCode: '0',
      errorMessage: 'Success',
      actionCode: 0,
      actionCodeDescription: 'Операция выполнена успешно',
      depositAmount: 19900,
    };
  }

  const requestParams = new URLSearchParams({
    userName: ALFA_MERCHANT_LOGIN,
    password: process.env.EXPO_PUBLIC_ALFA_MERCHANT_PASSWORD ?? '',
    orderId,
  });

  const response = await fetch(`${ALFA_API_URL}/rest/getOrderStatusExtended.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams.toString(),
  });

  const data = await response.json();

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`Failed to get payment status: ${data.errorMessage}`);
  }

  return data;
}

/**
 * Create recurring (auto-payment) with saved card binding
 */
export async function createRecurringPayment(
  params: RecurringPaymentParams
): Promise<PaymentResult> {
  const { bindingId, amount, orderNumber, description } = params;

  // STUB MODE
  if (STUB_MODE) {
    console.log('[STUB] Creating recurring payment:', { bindingId, amount, orderNumber });
    const orderId = generateStubOrderId();
    return {
      orderId,
      formUrl: '', // No form URL for recurring payments
    };
  }

  const requestParams = new URLSearchParams({
    userName: ALFA_MERCHANT_LOGIN,
    password: process.env.EXPO_PUBLIC_ALFA_MERCHANT_PASSWORD ?? '',
    orderNumber,
    amount: amount.toString(),
    bindingId,
    description,
  });

  const response = await fetch(`${ALFA_API_URL}/rest/paymentOrderBinding.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams.toString(),
  });

  const data = await response.json();

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`Recurring payment failed: ${data.errorMessage}`);
  }

  return {
    orderId: data.orderId,
    formUrl: '',
  };
}

/**
 * Get saved card bindings for a client
 */
export async function getBindings(clientId: string): Promise<BindingInfo[]> {
  // STUB MODE
  if (STUB_MODE) {
    console.log('[STUB] Getting bindings for client:', clientId);
    return [
      {
        bindingId: 'stub_binding_1',
        maskedPan: '4111****1111',
        expiryDate: '12/25',
        clientId,
      },
    ];
  }

  const requestParams = new URLSearchParams({
    userName: ALFA_MERCHANT_LOGIN,
    password: process.env.EXPO_PUBLIC_ALFA_MERCHANT_PASSWORD ?? '',
    clientId,
  });

  const response = await fetch(`${ALFA_API_URL}/rest/getBindings.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams.toString(),
  });

  const data = await response.json();

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`Failed to get bindings: ${data.errorMessage}`);
  }

  return (data.bindings ?? []).map((b: Record<string, unknown>) => ({
    bindingId: b.bindingId,
    maskedPan: b.maskedPan,
    expiryDate: b.expiryDate,
    clientId: b.clientId,
  }));
}

/**
 * Remove card binding
 */
export async function removeBinding(bindingId: string): Promise<void> {
  // STUB MODE
  if (STUB_MODE) {
    console.log('[STUB] Removing binding:', bindingId);
    return;
  }

  const requestParams = new URLSearchParams({
    userName: ALFA_MERCHANT_LOGIN,
    password: process.env.EXPO_PUBLIC_ALFA_MERCHANT_PASSWORD ?? '',
    bindingId,
  });

  const response = await fetch(`${ALFA_API_URL}/rest/unBindCard.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams.toString(),
  });

  const data = await response.json();

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`Failed to remove binding: ${data.errorMessage}`);
  }
}

/**
 * Refund payment
 */
export async function refundPayment(orderId: string, amount?: number): Promise<void> {
  // STUB MODE
  if (STUB_MODE) {
    console.log('[STUB] Refunding payment:', { orderId, amount });
    return;
  }

  const requestParams = new URLSearchParams({
    userName: ALFA_MERCHANT_LOGIN,
    password: process.env.EXPO_PUBLIC_ALFA_MERCHANT_PASSWORD ?? '',
    orderId,
  });

  if (amount !== undefined) {
    requestParams.append('amount', amount.toString());
  }

  const response = await fetch(`${ALFA_API_URL}/rest/refund.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams.toString(),
  });

  const data = await response.json();

  if (data.errorCode && data.errorCode !== '0') {
    throw new Error(`Refund failed: ${data.errorMessage}`);
  }
}

// ============================================================================
// Subscription Payment Flow
// ============================================================================

/**
 * Create subscription payment
 */
export async function createSubscriptionPayment(
  subscriptionType: SubscriptionType,
  options: {
    saveCard?: boolean;
    email?: string;
    phone?: string;
  } = {}
): Promise<{ orderId: string; formUrl: string; paymentId: string }> {
  const { saveCard = true, email, phone } = options;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Determine amount based on subscription type
  let amount: number;
  switch (subscriptionType) {
    case 'participant':
      amount = SUBSCRIPTION_CONFIG.prices.participant * 100; // Convert to kopecks
      break;
    case 'organizer':
      amount = SUBSCRIPTION_CONFIG.prices.organizer * 100;
      break;
    case 'single_event':
      amount = SUBSCRIPTION_CONFIG.prices.singleEvent * 100;
      break;
    default:
      throw new Error(`Invalid subscription type: ${subscriptionType}`);
  }

  // Create order number
  const orderNumber = `sub_${user.id.slice(0, 8)}_${Date.now()}`;

  // Create payment record in database
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      amount: amount / 100, // Store in rubles
      currency: 'RUB',
      status: 'pending',
      payment_type: 'subscription',
      metadata: {
        subscriptionType,
        orderNumber,
      },
    })
    .select()
    .single();

  if (paymentError) {
    throw new Error(`Failed to create payment record: ${paymentError.message}`);
  }

  // Create payment with Alfa-Bank
  const description = getSubscriptionDescription(subscriptionType);
  const result = await createPayment({
    amount,
    orderNumber,
    description,
    clientId: user.id,
    email,
    phone,
    features: saveCard ? 'AUTO_PAYMENT' : undefined,
  });

  // Update payment record with order ID
  await supabase
    .from('payments')
    .update({
      provider_payment_id: result.orderId,
      metadata: {
        ...payment.metadata,
        formUrl: result.formUrl,
      },
    })
    .eq('id', payment.id);

  return {
    orderId: result.orderId,
    formUrl: result.formUrl,
    paymentId: payment.id,
  };
}

/**
 * Create single event payment
 */
export async function createEventPayment(
  eventId: string,
  options: {
    email?: string;
    phone?: string;
  } = {}
): Promise<{ orderId: string; formUrl: string; paymentId: string }> {
  const { email, phone } = options;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, price')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  const amount = (event.price ?? SUBSCRIPTION_CONFIG.prices.singleEvent) * 100;
  const orderNumber = `evt_${eventId.slice(0, 8)}_${Date.now()}`;

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      event_id: eventId,
      amount: amount / 100,
      currency: 'RUB',
      status: 'pending',
      payment_type: 'event',
      metadata: {
        eventTitle: event.title,
        orderNumber,
      },
    })
    .select()
    .single();

  if (paymentError) {
    throw new Error(`Failed to create payment record: ${paymentError.message}`);
  }

  // Create payment with Alfa-Bank
  const result = await createPayment({
    amount,
    orderNumber,
    description: `Оплата участия: ${event.title}`,
    clientId: user.id,
    email,
    phone,
  });

  // Update payment record
  await supabase
    .from('payments')
    .update({
      provider_payment_id: result.orderId,
    })
    .eq('id', payment.id);

  return {
    orderId: result.orderId,
    formUrl: result.formUrl,
    paymentId: payment.id,
  };
}

/**
 * Process payment callback
 */
export async function processPaymentCallback(
  orderId: string
): Promise<{ success: boolean; payment: Payment | null }> {
  // Get payment status from Alfa-Bank
  const status = await getPaymentStatus(orderId);

  // Find payment record
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('provider_payment_id', orderId)
    .single();

  if (error || !payment) {
    console.error('Payment record not found:', orderId);
    return { success: false, payment: null };
  }

  // Update payment status based on Alfa-Bank response
  let newStatus: string;
  switch (status.orderStatus) {
    case ORDER_STATUS.AUTHORIZED:
      newStatus = 'completed';
      break;
    case ORDER_STATUS.CANCELLED:
    case ORDER_STATUS.AUTH_DECLINED:
      newStatus = 'failed';
      break;
    case ORDER_STATUS.REFUNDED:
      newStatus = 'refunded';
      break;
    default:
      newStatus = 'pending';
  }

  // Update payment record
  const { data: updatedPayment } = await supabase
    .from('payments')
    .update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      metadata: {
        ...payment.metadata,
        alfaStatus: status,
        bindingId: status.bindingInfo?.bindingId,
      },
    })
    .eq('id', payment.id)
    .select()
    .single();

  // If payment successful, activate subscription or event access
  if (newStatus === 'completed') {
    await activatePaymentBenefits(payment);
  }

  return {
    success: newStatus === 'completed',
    payment: updatedPayment as Payment,
  };
}

/**
 * Activate benefits after successful payment
 */
async function activatePaymentBenefits(payment: Record<string, unknown>): Promise<void> {
  const userId = payment.user_id as string;
  const paymentType = payment.payment_type as string;
  const metadata = payment.metadata as Record<string, unknown>;

  if (paymentType === 'subscription') {
    const subscriptionType = metadata.subscriptionType as SubscriptionType;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        type: subscriptionType,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: expiresAt.toISOString(),
        auto_renew: true,
      });

    // Update profile
    await supabase
      .from('profiles')
      .update({
        subscription_type: subscriptionType,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);
  } else if (paymentType === 'event') {
    const eventId = payment.event_id as string;

    // Add user as participant
    await supabase
      .from('participants')
      .upsert({
        event_id: eventId,
        user_id: userId,
        status: 'confirmed',
        payment_status: 'paid',
      });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getSubscriptionDescription(type: SubscriptionType): string {
  switch (type) {
    case 'participant':
      return 'MeetUp.local - Подписка Участник (1 месяц)';
    case 'organizer':
      return 'MeetUp.local - Подписка Организатор (1 месяц)';
    case 'single_event':
      return 'MeetUp.local - Разовый доступ';
    default:
      return 'MeetUp.local - Оплата';
  }
}

/**
 * Convert payment status to human-readable text
 */
export function getPaymentStatusText(status: number): string {
  switch (status) {
    case ORDER_STATUS.REGISTERED:
      return 'Ожидает оплаты';
    case ORDER_STATUS.PREAUTHORIZED:
      return 'Сумма заблокирована';
    case ORDER_STATUS.AUTHORIZED:
      return 'Оплачено';
    case ORDER_STATUS.CANCELLED:
      return 'Отменено';
    case ORDER_STATUS.REFUNDED:
      return 'Возвращено';
    case ORDER_STATUS.ACS_AUTH:
      return 'Ожидает подтверждения';
    case ORDER_STATUS.AUTH_DECLINED:
      return 'Отклонено';
    default:
      return 'Неизвестно';
  }
}

/**
 * Check if running in stub mode
 */
export function isStubMode(): boolean {
  return STUB_MODE;
}
