-- Expõe a escolha de imagem por grupo monitorado no painel (antes o modo era
-- fixado em 'original' no código, em src/billing/groupEntitlements.js, e a UI
-- forçava todo grupo de volta para 'original').
--
-- Grupos monitorados existentes que ficaram no default de schema ('none') nunca
-- tiveram escolha real do usuário — a opção não era exposta. Para não regredir
-- (passariam a sair SEM imagem), migra-os para 'original', que é exatamente o
-- comportamento efetivo que tinham até aqui. A partir de agora 'none' passa a
-- significar uma escolha explícita do cliente por "sem imagem".
UPDATE "Group" SET "imageMode" = 'original' WHERE "role" = 'monitor' AND "imageMode" = 'none';
