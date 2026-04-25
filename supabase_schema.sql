-- ============================================================
-- Print3D — Schema de base de datos
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Clientes
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  notas text,
  created_at timestamptz default now()
);

-- Piezas (archivos STL)
create table piezas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cliente_id uuid references clientes(id) on delete set null,
  archivo_url text,
  volumen_cm3 numeric,
  dim_x numeric, dim_y numeric, dim_z numeric,
  triangulos integer,
  created_at timestamptz default now()
);

-- Cotizaciones
create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  pieza_id uuid references piezas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  operador text,
  notas text,
  material text default 'PLA',
  infill integer default 20,
  con_soporte boolean default false,
  peso_g numeric,
  tiempo_min integer,
  costo_filamento numeric,
  costo_electricidad numeric,
  costo_maquina numeric,
  costo_mo numeric,
  costo_total numeric,
  margen_pct numeric,
  precio_final numeric,
  moneda text default '$',
  created_at timestamptz default now()
);

-- Pedidos
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  estado text default 'pendiente'
    check (estado in ('pendiente','confirmado','produccion','listo','entregado')),
  total numeric,
  notas text,
  fecha_entrega_estimada date,
  fecha_entrega_real date,
  pagado boolean default false,
  metodo_pago text,
  created_at timestamptz default now()
);

-- Items de pedido (N piezas por pedido)
create table items_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id) on delete cascade,
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  cantidad integer default 1,
  precio_unitario numeric,
  subtotal numeric,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security — todos los usuarios autenticados ven todo
-- ============================================================
alter table clientes enable row level security;
alter table piezas enable row level security;
alter table cotizaciones enable row level security;
alter table pedidos enable row level security;
alter table items_pedido enable row level security;

create policy "auth_all" on clientes for all to authenticated using (true) with check (true);
create policy "auth_all" on piezas for all to authenticated using (true) with check (true);
create policy "auth_all" on cotizaciones for all to authenticated using (true) with check (true);
create policy "auth_all" on pedidos for all to authenticated using (true) with check (true);
create policy "auth_all" on items_pedido for all to authenticated using (true) with check (true);

-- ============================================================
-- Storage bucket para archivos STL
-- ============================================================
insert into storage.buckets (id, name, public) values ('archivos', 'archivos', true);

create policy "auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'archivos');
create policy "public_read" on storage.objects for select using (bucket_id = 'archivos');
create policy "auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'archivos');
