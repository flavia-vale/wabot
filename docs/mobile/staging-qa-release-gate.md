# Mobile staging QA and release gate

Este checklist fecha a sequência de estabilização mobile antes de liberar para produção. Ele deve ser executado em staging (`http://178.105.54.0:3006`) depois do merge em `develop` e antes de qualquer promoção para `main`.

## Escopo protegido

- `/m/op/offer`: templates, preço (`price`, `newPrice`, `priceNow`), bônus de grupo/cupom e exigência de destino real.
- `/m/config/groups`: carregamento de grupos do WhatsApp, cadastro por aba ativa (`Monitorar` ou `Publicar`) e duplicidade por `waJid + role`.
- `/m/config/preferences`: apenas campos com contrato real no `BotConfig` aparecem como persistidos.
- `/m/account/templates`: presets locais, sem promessa de persistência backend.
- `/m/op/converter`: múltiplos resultados, erro por item e feedback de copiar.
- `/m/op/logs`: mensagens honestas, paginação e sem ações mobile sem contrato seguro.

## Checks locais obrigatórios

```bash
cd /workspace/wabot && node --test test/mobile-offer-composer.test.js test/mobile-groups-picker.test.js test/mobile-config-contracts.test.js test/mobile-converter.test.js test/mobile-logs.test.js
cd /workspace/wabot/dashboard && npm run lint
cd /workspace/wabot/dashboard && npm run smoke:mobile-p1 && npm run smoke:mobile-p2 && npm run smoke:mobile-p3 && npm run smoke:mobile-routes
cd /workspace/wabot/dashboard && npm run build
```

## Checklist manual em staging

1. Abrir `http://178.105.54.0:3006/m/op/offer`.
   - Todos os templates mostram preço no preview.
   - Produto raspado com `newPrice` mostra preço na mensagem.
   - Bônus de grupo aparece apenas com link de grupo preenchido.
   - Cupom aparece apenas quando há loja selecionada e link preenchido.
   - Envio exige destino real.
2. Abrir `http://178.105.54.0:3006/m/config/groups`.
   - Botão carrega grupos reais do WhatsApp.
   - Lista aparece ordenada por nome.
   - Na aba Monitorar, tocar em um grupo cadastra como monitorado.
   - Na aba Publicar, tocar no mesmo grupo cadastra como destino de publicação.
   - Grupo já cadastrado nas duas roles aparece como já cadastrado em ambas as abas.
   - Tentativa duplicada retorna feedback claro.
3. Abrir `http://178.105.54.0:3006/m/config/preferences`.
   - Nenhum toggle de notificação sem contrato aparece como salvo.
   - Campos salvos recarregam igual após refresh.
4. Abrir `http://178.105.54.0:3006/m/account/templates`.
   - Tela informa que modelos são presets locais.
   - Não há botão prometendo salvar modelos no backend.
5. Abrir `http://178.105.54.0:3006/m/op/converter`.
   - Colar dois links suportados e validar múltiplos resultados.
   - Validar erro por item quando falta credencial ou conversão falha.
   - Copiar um link e copiar todos exibem feedback.
6. Abrir `http://178.105.54.0:3006/m/op/logs`.
   - Logs carregam com paginação.
   - Erros aparecem com mensagem clara.
   - Não há botões de reenvio/repostagem sem contrato seguro.

## Evidências para aprovação

- Screenshot mobile de `/m/op/offer` com o bloco “Adicionar à mensagem”.
- Screenshot mobile de `/m/config/groups` com lista de grupos do WhatsApp carregada.
- Screenshot mobile de `/m/op/converter` com múltiplos resultados.
- Screenshot mobile de `/m/op/logs` com detalhe de erro expandido.

## Gate de release

- Não tocar produção durante QA.
- Só abrir promoção `develop -> main` depois de aprovação manual explícita na porta `3006`.
- Se qualquer item falhar, corrigir em novo commit/PR para `develop` e repetir staging.
