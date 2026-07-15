-- Adiciona a pergunta de segurança de credenciais ao FAQ dinâmico da landing
-- (mesmo texto usado no schema JSON-LD via CORE_FAQ_ITEMS). Migration aditiva,
-- não altera nem apaga dados existentes.
INSERT INTO "FaqItem" ("id", "question", "answer", "position", "isActive", "updatedAt") VALUES
('faq_seed_security', 'Meus dados de afiliado ficam seguros?', 'Sim. As credenciais das suas contas de afiliado e sua chave PIX ficam criptografadas em repouso (AES-256-GCM), não em texto puro no banco. O login também tem proteção contra tentativas de força bruta.', 7, true, CURRENT_TIMESTAMP);
