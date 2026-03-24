-- ==========================================
-- KAZZI COMPANY - SUPABASE INITIALIZATION
-- ==========================================

-- 1. Create kazzi_products table
CREATE TABLE IF NOT EXISTS public.kazzi_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'all',
    preco NUMERIC DEFAULT 0,
    estoque INTEGER DEFAULT 0,
    descricao TEXT,
    imagem TEXT,
    storage_path TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    imagens_extra JSONB DEFAULT '[]'::jsonb
);

-- Upgrade for existing instances: Add imagens_extra if not exists
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.kazzi_products ADD COLUMN imagens_extra JSONB DEFAULT '[]'::jsonb;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;

-- 2. Create kazzi_orders table
CREATE TABLE IF NOT EXISTS public.kazzi_orders (
    id TEXT PRIMARY KEY,
    itens JSONB,
    total NUMERIC,
    endereco JSONB,
    cliente_nome TEXT,
    cliente_telefone TEXT,
    cliente_email TEXT,
    metodo_pagamento TEXT,
    status TEXT DEFAULT 'aguardando_pagamento',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create kazzi_settings table (for store configurations)
CREATE TABLE IF NOT EXISTS public.kazzi_settings (
    id TEXT PRIMARY KEY,
    pagseguro_email TEXT,
    uber_email TEXT,
    store_name TEXT,
    store_phone TEXT,
    store_addr TEXT,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic row-level security (RLS) setup to allow read and write
-- WARNING: In a production environment, you should secure the WRITE policies 
-- strictly to authenticated Admin users. For now, we are allowing authenticated
-- writes and public reads to unblock the application.
ALTER TABLE public.kazzi_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.kazzi_products FOR SELECT USING (true);
CREATE POLICY "Auth Write Access" ON public.kazzi_products FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.kazzi_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Insert Access" ON public.kazzi_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Full Access" ON public.kazzi_orders FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.kazzi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Settings" ON public.kazzi_settings FOR SELECT USING (true);
CREATE POLICY "Auth Admin Settings" ON public.kazzi_settings FOR ALL USING (auth.role() = 'authenticated');

-- 4. Create the Storage Bucket for media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kazzi-media', 'kazzi-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for kazzi-media
-- Allows public access to view images, but only authenticated users can upload/delete
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'kazzi-media');
CREATE POLICY "Auth Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kazzi-media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Updates" ON storage.objects FOR UPDATE USING (bucket_id = 'kazzi-media' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Deletes" ON storage.objects FOR DELETE USING (bucket_id = 'kazzi-media' AND auth.role() = 'authenticated');
