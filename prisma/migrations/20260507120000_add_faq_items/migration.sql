-- CreateTable: FAQ dinâmico da landing page. Migration aditiva; não altera nem apaga dados existentes.
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FaqItem_isActive_position_idx" ON "FaqItem"("isActive", "position");

-- Dados iniciais não destrutivos para manter a LP preenchida após o deploy.
INSERT INTO "FaqItem" ("id", "question", "answer", "position", "isActive") VALUES
('faq_seed_whatsapp_ban', 'Vou ser banida do WhatsApp?', 'O Wabot respeita limites de envio, usa intervalos configuráveis e permite filtros anti-spam. Ainda assim, recomendamos operar com grupos autorizados e mensagens relevantes para reduzir riscos.', 1, true),
('faq_seed_cancel', 'Posso cancelar quando quiser?', 'Sim. Você pode interromper o uso quando quiser e não precisa falar com call center para parar sua operação.', 2, true),
('faq_seed_phone', 'Preciso deixar meu celular ligado?', 'Depois de conectar a sessão pelo QR Code, o bot roda no servidor e continua monitorando conforme sua configuração.', 3, true),
('faq_seed_programs', 'Funciona com quais programas de afiliados?', 'Hoje suportamos Shopee, Mercado Livre, Amazon e Magalu. Basta cadastrar suas credenciais no painel para as plataformas que você usa.', 4, true),
('faq_seed_text', 'Posso controlar os envios?', 'Sim. Você define grupos de origem e destino, filtros por palavras, plataformas permitidas e pode acompanhar tudo pelo histórico de logs.', 5, true),
('faq_seed_groups', 'Posso escolher para qual grupo cada link vai?', 'Sim. Você pode configurar grupos de destino por origem e manter sua operação organizada por público ou categoria.', 6, true);
