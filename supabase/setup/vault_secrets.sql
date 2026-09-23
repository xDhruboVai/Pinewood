select vault.create_secret(
  'https://mtxvmhgxpsjkopwnnmiv.supabase.co/functions/v1',
  'pinewood_functions_url',
  'Base URL for Pine Wood Edge Functions'
);

select vault.create_secret(
  'b2587d15b3c826a565ffc7fea8bc07553dd5625928642d1c0863e95fc0d35f1a',
  'pinewood_webhook_secret',
  'Shared secret sent as x-webhook-secret to reservation-email'
);