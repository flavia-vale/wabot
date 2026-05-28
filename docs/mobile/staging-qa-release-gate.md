# Mobile staging QA and release gate

Este checklist fecha a sequência de estabilização mobile antes de liberar para produção. Ele deve ser executado em staging (`http://178.105.54.0:3006`) depois do merge em `develop` e antes de qualquer promoção para `main`.

## Escopo protegido

- `/m/op/offer`: templates, preço (`price`, `newPrice`, `priceNow`), bônus de grupo/cupom, validação de URL, exigência de um único link por oferta e destino real.
- `/m/config/groups`: carregamento de grupos do WhatsApp, cadastro por aba ativa (`Monitorar` ou `Publicar`), duplicidade por `waJid + role` e feedback claro para duplicidade manual.
- `/m/config/preferences`: apenas campos com contrato real no `BotConfig` aparecem como persistidos.
- `/m/account/templates`: presets locais, sem promessa de persistência backend.
- `/m/op/converter`: múltiplos resultados, erro por item, validação local básica, feedback de copiar e handoff para `/m/op/offer?url=...`.
- `/m/op/logs`: mensagens honestas, paginação, contadores dos envios carregados e ações seguras de copiar/abrir links, sem reenvio/repostagem mobile.

## Checks locais obrigatórios

```bash
cd /workspace/wabot && node --test test/mobile-offer-composer.test.js test/mobile-groups-picker.test.js test/mobile-config-contracts.test.js test/mobile-converter.test.js test/mobile-logs.test.js
cd /workspace/wabot/dashboard && npm run lint
cd /workspace/wabot/dashboard && npm run smoke:mobile-p1 && npm run smoke:mobile-p2 && npm run smoke:mobile-p3 && npm run smoke:mobile-routes
cd /workspace/wabot/dashboard && npm run build
```

## Checklist manual em staging

1. Abrir `http://178.105.54.0:3006/m/op/offer`.
   - Colar dois links e confirmar que aparece aviso para usar apenas um link por oferta.
   - Todos os templates mostram preço no preview.
   - Produto raspado com `newPrice` mostra preço na mensagem.
   - Bônus de grupo aparece apenas com link `http://` ou `https://` preenchido.
   - Link inválido de grupo/cupom aparece como aviso e não entra na mensagem.
   - Cupom usa apenas o link da loja correspondente à oferta.
   - Depois de preencher links de cupom, recarregar a página e confirmar que continuam editáveis.
   - Editar manualmente a mensagem, alterar bônus e confirmar o aviso “Atualizar bônus vai regenerar a mensagem”.
   - Envio exige destino real.
2. Abrir `http://178.105.54.0:3006/m/config/groups`.
   - Botão carrega grupos reais do WhatsApp.
   - Lista aparece ordenada por nome.
   - Na aba Monitorar, tocar em um grupo cadastra como monitorado.
   - Na aba Publicar, tocar no mesmo grupo cadastra como destino de publicação.
   - Grupo já cadastrado nas duas roles aparece como já cadastrado em ambas as abas.
   - Cadastro manual duplicado retorna “Este grupo já está cadastrado para monitorar/publicar.” sem criar duplicata.
3. Abrir `http://178.105.54.0:3006/m/config/preferences`.
   - Nenhum toggle de notificação sem contrato aparece como salvo.
   - Campos salvos recarregam igual após refresh.
4. Abrir `http://178.105.54.0:3006/m/account/templates`.
   - Tela informa que modelos são presets locais.
   - Não há botão prometendo salvar modelos no backend.
5. Abrir `http://178.105.54.0:3006/m/op/converter`.
   - Colar dois links suportados e validar múltiplos resultados.
   - Validar erro por item quando falta credencial ou conversão falha.
   - Colar texto com `;` entre links e confirmar validação local antes da API.
   - Copiar um link e copiar todos exibem feedback.
   - Em um item convertido, tocar em “Criar oferta” e confirmar que `/m/op/offer` abre com o link preenchido via query string.
6. Abrir `http://178.105.54.0:3006/m/op/logs`.
   - Logs carregam com paginação.
   - Filtros indicam que contadores são dos envios carregados na tela.
   - Botão “Atualizar” recarrega a primeira página.
   - Erros aparecem com mensagem clara.
   - Detalhe expandido permite copiar link original/convertido quando existirem.
   - Detalhe expandido permite abrir URL válida em nova aba.
   - Não há botões de reenvio/repostagem sem contrato seguro.

## Evidências para aprovação

- Screenshot mobile de `/m/op/offer` com o bloco “Adicionar à mensagem” e aviso de regeneração quando a mensagem foi editada.
- Screenshot mobile de `/m/config/groups` com lista de grupos do WhatsApp carregada e/ou duplicidade manual bloqueada.
- Screenshot mobile de `/m/op/converter` com múltiplos resultados e botão “Criar oferta” em item convertido.
- Screenshot mobile de `/m/op/logs` com detalhe expandido e ações de copiar/abrir links.

## Status local desta rodada

- PR A: testes de estabilização de oferta executados localmente.
- PR B: grupos mobile receberam feedback de duplicidade manual e testes de helper/role.
- PR C: converter mobile ganhou validação local e handoff para `/m/op/offer?url=...`.
- PR D: logs mobile ganharam ações seguras e copy honesto de contadores carregados.
- PR E: este gate foi atualizado para validar os itens acima em staging; a execução manual em `http://178.105.54.0:3006` ainda é obrigatória após merge em `develop`.

## Gate de release

- Não tocar produção durante QA.
- Só abrir promoção `develop -> main` depois de aprovação manual explícita na porta `3006`.
- Se qualquer item falhar, corrigir em novo commit/PR para `develop` e repetir staging.
