# Relatório de Investigação de UX: Conexão WhatsApp (CuponitoV2/BOTinho)

## 1) Fluxo atual (antes de qualquer redesign)

### Quando o usuário clica em **"Gerar QR Code"**
1. UI limpa mensagens de erro/feedback e entra em loading da ação (`actionLoading='connect'`, botão vira `Conectando...`).
2. Front chama `sessionStart` (com tolerância para `409`) e abre socket de QR (`sessionQRTicket` + `openQRSocket`).
3. Se status estiver `running + connecting` e ainda sem QR, mostra bloco com spinner verde, contador em segundos e texto "Gerando QR Code...".
4. Existe fallback por polling (`sessionQRLatest`) a cada 3s caso socket não entregue QR.
5. Se o socket não entregar QR em 25s e sessão continuar conectando, exibe alerta de warning de canal de QR possivelmente preso.

### O que o usuário enxerga (cores/textos/animações)
- Status-dot: verde (conectado), amarelo com `animate-pulse` (conectando), cinza (desconectado).
- Card de espera: spinner SVG `animate-spin`, mensagem de preparo e contador em segundos.
- Botões primários:
  - QR: verde (`bg-green-600`).
  - Pareamento por número: azul (`bg-blue-600`).
- Erros e avisos aparecem em `Alert` com tipos `error` e `warning`.
- Sucesso aparece em `Alert` tipo `success` com texto "Tudo certo".

### Quando QR expira/falha
- Não há um estado explícito de "QR expirado" com timestamp visível ao usuário.
- Há mecanismo indireto de recuperação: após 20s sem QR aparece "Tentar novamente"; após 25s pode aparecer warning técnico do canal de QR.

## 2) Pontos de abandono (onde e por que o usuário desiste)

1. **Janela de incerteza de 0–20s**: apesar de existir spinner, usuário pode interpretar como travamento quando não recebe QR rápido.
2. **Erro técnico demais**: mensagens como "Falha no canal de QR Code" + "Verifique URL/API" deslocam responsabilidade para usuário final.
3. **Ausência de validade do QR na interface**: sem indicador de expiração/renovação, o QR "morto" parece bug.
4. **Recuperação distribuída em várias ações**: "Tentar novamente", "Reiniciar conexão", "Esquecer número" competem cognitivamente.
5. **Hierarquia mista entre ações normais e avançadas**: área de "Ações avançadas" pode parecer caminho obrigatório para usuário ansioso.

## 3) Análise de feedback visual (controle percebido)

### O que já ajuda
- Estado de loading e contador explícitos.
- Mudança textual do botão (`Gerar QR Code` → `Conectando...`).
- Indicador de status com semáforo de cor.

### O que falta para sensação de controle
- Barra de progresso por etapas (ex.: Iniciando sessão → Gerando QR → Aguardando leitura → Confirmando).
- Timer de validade do QR (ex.: "Expira em 00:18").
- CTA único de recuperação contextual (em vez de múltiplas opções simultâneas).
- Mensagens menos técnicas e mais orientadas à ação humana.

## 4) Sugestão de redesign de fluxo (clique até sucesso)

1. **Clique em "Gerar QR"**
   - Travar botões alternativos por 8–10s para evitar duplo clique e corrida de estado.
   - Mostrar stepper visual de 4 etapas com tempo estimado.

2. **QR disponível**
   - Renderizar QR maior (>= 240px) + moldura de alto contraste.
   - Mostrar validade regressiva e auto-refresh com mensagem: "Atualizamos automaticamente se expirar".

3. **Sem QR em 12s**
   - Substituir aviso técnico por bloco de recuperação: "Estamos com lentidão para gerar o QR" + botão primário "Gerar novo QR".

4. **Sem progresso em 30–45s (detecção de inatividade)**
   - Acionar modo assistido automaticamente com CTA: **"Resetar instância"**.
   - Microcopy: "Isso limpará tentativas anteriores e abrirá um novo caminho seguro.".

5. **Sucesso**
   - Estado confirmado com check verde, número conectado mascarado e próximo passo ("Ir para Grupos").

## 5) Copywriting de suporte (erro e sucesso)

### Erros (humanizados)
- "Demorou mais que o normal para gerar o QR. Toque em **Gerar novo QR**."
- "Sua conexão oscilou durante o pareamento. Mantenha esta tela aberta e tente novamente."
- "Não conseguimos concluir agora. Vamos resetar a sessão para abrir um novo pareamento seguro."

### Sucesso
- "WhatsApp conectado com sucesso! Seu bot já pode monitorar e enviar mensagens."
- "Conexão confirmada. Próximo passo: escolher grupos de origem e destino."

## 6) Recomendação de instrumentação UX

- Eventos com timestamps para funil:
  - `connect_click`
  - `qr_requested`
  - `qr_rendered`
  - `qr_scanned`
  - `connected`
  - `recovery_clicked`
  - `instance_reset_clicked`
- KPI alvo:
  - Tempo mediano clique→QR.
  - Taxa de abandono antes do QR.
  - Taxa de sucesso em até 2 minutos.

## 7) Próximos passos sugeridos

1. Implementar estado explícito de expiração do QR e CTA único contextual.
2. Criar fluxo automático de recuperação por inatividade com "Resetar instância".
3. Rodar teste moderado com 5–8 usuários reais e medir redução de "botão não funciona".
