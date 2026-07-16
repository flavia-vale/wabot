# Quadro de objeções — BOTinho

Referência rápida para responder durante a conversa (DM, ligação, call de
demo). Cada linha: objeção como a pessoa realmente fala, resposta em 1-2
frases, e a prova técnica por trás — sem prometer o que o produto não
controla.

| Objeção | Resposta rápida | Prova por trás |
|---|---|---|
| "Vou ser banida do WhatsApp por usar bot?" | "Nenhuma ferramenta elimina esse risco — inclusive desconfie de quem promete isso. O BOTinho reduz o que dá pra reduzir: intervalos configuráveis, filtros anti-spam e revisão antes de publicar." | FAQ público (`faq_seed_whatsapp_ban`); Módulo de Preservação Avançada (cadência, variação de copy, pausas preventivas). |
| "E se o bot cair no meio de uma campanha?" | "A conexão com o WhatsApp roda num processo separado da aplicação principal — atualizar o sistema não derruba sua sessão. E se cair por instabilidade de rede, ele tenta reconectar sozinho." | Arquitetura de supervisor dedicado; ver `/confiabilidade-sessao-whatsapp`. |
| "Meus dados de afiliado ficam seguros com vocês?" | "Suas credenciais e sua chave PIX ficam criptografadas no banco, não em texto puro. E o login tem proteção contra tentativa de força bruta." | Criptografia AES-256-GCM (D-3); rate limit de login (A-1); ver `/seguranca-credenciais-afiliado`. |
| "Por que não uso planilha/copiar e colar manual?" | "Funciona pra pouco volume. Quando você passa de 1-2 grupos, o tempo de copiar link e trocar código de afiliado começa a competir com o tempo de achar a oferta boa. O bot tira essa parte, você continua no controle da oferta." | Comparativo público: `botinho-vs-planilha-manual`. |
| "Já uso outro bot/automação genérica." | "Legal, o que ele não resolve hoje pra você?" (pergunta, não afirmação — deixar a pessoa nomear a dor antes de comparar). Se insistir em comparar: cadência configurável, canais + grupos no mesmo fluxo, e histórico de logs para auditar o que foi enviado/bloqueado. | Comparativo público: `botinho-vs-ferramentas-genericas-automacao`. |
| "É caro." | "Tem teste grátis de 7 dias com tudo do Pro liberado, sem cartão. Faz a conta de quanto tempo por semana você gasta copiando link manualmente — geralmente o plano paga isso rápido." | Trial em `pricing.md`; ROI qualitativo, não prometer número de retorno financeiro. |
| "Preciso deixar o celular ligado?" | "Não. Depois de conectar via QR Code, o bot roda no servidor." | FAQ público (`faq_seed_phone`). |
| "Funciona só com Shopee?" | "Hoje: Shopee, Mercado Livre, Amazon e Magalu. Cadastra as credenciais das plataformas que você usa." | FAQ público (`faq_seed_programs`). |
| "Posso cancelar quando quiser?" | "Sim, sem precisar falar com atendimento pra isso." | FAQ público (`faq_seed_cancel`). |

## Regra ao usar este quadro

Nunca prometer resultado financeiro, aprovação de marketplace ou ausência
total de risco de banimento — mesmo sob pressão de fechar a venda. É a
mesma linha que o produto já segue em `pricing.md` e no FAQ público; quebrar
isso numa conversa de venda solta a mesma promessa que o site
deliberadamente evita.
