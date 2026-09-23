select vault.create_secret(
  'https://mtxvmhgxpsjkopwnnmiv.supabase.co/functions/v1',
  'pinewood_functions_url',
  'Base URL for Pine Wood Edge Functions'
);

select vault.create_secret(
  'technobladeneverdies',
  'pinewood_webhook_secret',
  'Shared secret sent as x-webhook-secret to reservation-email'
);