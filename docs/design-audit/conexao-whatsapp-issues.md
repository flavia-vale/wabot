# Auditoria SEO & Conversão — `/dashboard` Conexão WhatsApp

## Contexto da página
Página operacional para conectar, parear, desligar ou esquecer a sessão de WhatsApp do bot.

## ISSUE CONEXAO-001 — Adicionar passo a passo visual de conexão
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** CTAs “Conectar via QR Code” e “Conectar pelo número”.
- **Observação técnica:** A página oferece métodos de conexão, mas não antecipa claramente o passo a passo dentro do WhatsApp.
- **Impacto em ativação:** Usuários menos técnicos podem abandonar ao não entender onde escanear QR ou inserir código.
- **Sugestão de melhoria:** Inserir bloco “Como conectar” com 3 passos: abrir WhatsApp, acessar aparelhos conectados, escanear QR/inserir código.
- **Critérios de aceite:**
  - Passos aparecem antes ou ao lado do QR/código.
  - Copy diferencia QR Code e pareamento por número.
  - Não interrompe usuários já conectados.
- **Testes sugeridos:** Validar estados disconnected, connecting e connected.

## ISSUE CONEXAO-002 — Melhorar validação e máscara do telefone de pareamento
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Campo de telefone para código de pareamento.
- **Observação técnica:** O formulário aceita texto livre e depende da API para falhar.
- **Impacto em UX:** Erros de formato podem gerar frustração e chamadas desnecessárias ao backend.
- **Sugestão de melhoria:** Adicionar exemplo visível “Ex.: 5511999999999”, validação mínima e mensagem local antes de chamar API.
- **Critérios de aceite:**
  - Campo aceita apenas dígitos ou normaliza caracteres comuns.
  - Exibe erro local para números curtos/inválidos.
  - Mantém acessibilidade com `aria-live`.
- **Testes sugeridos:** Testar número vazio, curto, com símbolos e válido.

## ISSUE CONEXAO-003 — Adicionar troubleshooting para QR expirado/instável
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Mensagens de socket error/closed e timeout de QR.
- **Observação técnica:** A página informa instabilidade, mas não orienta ações como gerar novo QR, conferir internet ou reiniciar sessão.
- **Impacto em ativação:** Usuário pode não saber qual ação tomar quando o QR não aparece.
- **Sugestão de melhoria:** Adicionar card de ajuda quando o QR demorar: “Não apareceu? Gere novamente, confira internet do celular e evite múltiplas tentativas simultâneas.”
- **Critérios de aceite:**
  - Ajuda aparece apenas em timeout/erro de conexão.
  - CTA de retry é claro e não duplica ações perigosas.
- **Testes sugeridos:** Simular `socketState=error`, `closed` e timeout sem QR.

## ISSUE CONEXAO-004 — Reforçar segurança ao esquecer sessão
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Ação de esquecer sessão.
- **Observação técnica:** Existe confirmação, mas a copy pode explicar melhor que será necessário reconectar o WhatsApp.
- **Impacto em suporte:** Reduz cliques acidentais e dúvidas após remoção da sessão.
- **Sugestão de melhoria:** Ajustar mensagem do modal para “Esta ação remove a sessão salva. Você precisará escanear um novo QR Code para voltar a usar o bot.”
- **Critérios de aceite:**
  - Modal explicita consequência e reversibilidade operacional.
  - Botão destrutivo permanece destacado.
- **Testes sugeridos:** Validar cancelar/confirmar e estado após sucesso.
