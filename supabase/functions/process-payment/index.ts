/**
 * Process Payment Callback Edge Function
 * Handles payment webhook from Alfa-Bank
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Payment status codes from Alfa-Bank
const ORDER_STATUS = {
  REGISTERED: 0,
  PREAUTHORIZED: 1,
  AUTHORIZED: 2,
  CANCELLED: 3,
  REFUNDED: 4,
  ACS_AUTH: 5,
  AUTH_DECLINED: 6,
} as const;

interface PaymentCallbackPayload {
  orderId: string;
  status?: string;
  checksum?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const body: PaymentCallbackPayload = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing payment callback for order: ${orderId}`);

    // Get payment status from Alfa-Bank
    const alfaStatus = await getPaymentStatus(orderId);
    console.log(`Alfa-Bank status:`, alfaStatus);

    // Find payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('provider_payment_id', orderId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', orderId);
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine new status
    let newStatus: string;
    switch (alfaStatus.orderStatus) {
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
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        metadata: {
          ...payment.metadata,
          alfaStatus,
          bindingId: alfaStatus.bindingInfo?.bindingId,
        },
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      throw updateError;
    }

    // Process successful payment
    if (newStatus === 'completed') {
      await activatePaymentBenefits(supabase, payment);
    }

    // Send push notification
    await sendPaymentNotification(supabase, payment.user_id, newStatus, payment);

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Get payment status from Alfa-Bank API
 */
async function getPaymentStatus(orderId: string): Promise<{
  orderStatus: number;
  orderNumber: string;
  amount: number;
  bindingInfo?: { bindingId: string };
}> {
  const alfaApiUrl = Deno.env.get('ALFA_API_URL') ?? 'https://pay.alfabank.ru/payment';
  const merchantLogin = Deno.env.get('ALFA_MERCHANT_LOGIN') ?? '';
  const merchantPassword = Deno.env.get('ALFA_MERCHANT_PASSWORD') ?? '';

  // STUB MODE - return mock response if no credentials
  if (!merchantLogin) {
    console.log('[STUB] Returning mock payment status');
    return {
      orderStatus: ORDER_STATUS.AUTHORIZED,
      orderNumber: `order_${Date.now()}`,
      amount: 19900,
    };
  }

  const params = new URLSearchParams({
    userName: merchantLogin,
    password: merchantPassword,
    orderId,
  });

  const response = await fetch(`${alfaApiUrl}/rest/getOrderStatusExtended.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  return response.json();
}

/**
 * Activate benefits after successful payment
 */
async function activatePaymentBenefits(
  supabase: ReturnType<typeof createClient>,
  payment: Record<string, unknown>
): Promise<void> {
  const userId = payment.user_id as string;
  const paymentType = payment.payment_type as string;
  const metadata = payment.metadata as Record<string, unknown>;

  if (paymentType === 'subscription') {
    const subscriptionType = metadata.subscriptionType as string;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Create or update subscription
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

    console.log(`Activated ${subscriptionType} subscription for user ${userId}`);
  } else if (paymentType === 'event') {
    const eventId = payment.event_id as string;

    // Confirm participation
    await supabase
      .from('participants')
      .upsert({
        event_id: eventId,
        user_id: userId,
        status: 'confirmed',
        payment_status: 'paid',
      });

    // Increment event participant count
    await supabase.rpc('increment_participants', { event_id: eventId });

    console.log(`Confirmed participation for user ${userId} in event ${eventId}`);
  }
}

/**
 * Send push notification about payment status
 */
async function sendPaymentNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  status: string,
  payment: Record<string, unknown>
): Promise<void> {
  // Get user's push tokens
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) {
    console.log('No push tokens found for user:', userId);
    return;
  }

  let title: string;
  let body: string;

  if (status === 'completed') {
    if (payment.payment_type === 'subscription') {
      title = 'Подписка активирована!';
      body = 'Спасибо за оплату. Теперь вам доступны все возможности MeetUp.local';
    } else {
      title = 'Оплата прошла успешно!';
      body = 'Вы записаны на встречу. Увидимся!';
    }
  } else if (status === 'failed') {
    title = 'Оплата не прошла';
    body = 'К сожалению, оплата не прошла. Попробуйте ещё раз.';
  } else {
    return; // Don't send notification for other statuses
  }

  // Send via Expo Push Notification service
  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: {
      type: 'payment_status',
      status,
      paymentId: payment.id,
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    console.log('Push notifications sent');
  } catch (error) {
    console.error('Failed to send push notifications:', error);
  }
}
