-- Community submissions now remember the barcode that sent the user to the ingredient scan,
-- so approving a submission makes that barcode work for everyone.
-- Safe to run more than once.
alter table public.pending_products
  add column if not exists barcode text;

create index if not exists pending_products_barcode_idx
  on public.pending_products (barcode)
  where barcode is not null;
