alter table public.shopify_shops
  add column refresh_token_enc text,
  add column access_token_expires_at timestamptz;

-- Platform admins see audit-relevant rows through the server only; nothing extra exposed to clients.
create index on public.refund_requests(status, created_at);
create index on public.support_tickets(status, updated_at desc);
create index on public.orders(status, created_at desc);
