# Integrity Check - Protected Core

## Arquivos blindados
- `src/core/sessionCore.js`
- `src/core/linkCore.js`
- `src/core/contracts.js`
- `src/core/errors.js`

## Regras de imutabilidade
1. Não alterar assinatura pública de sessão (`startBot`, `stopBot`, `onQR`, `onStatus`, `listGroups`, `sendBroadcast`, `requestPairingCode`, `getBotMetrics`, `reloadConfig`).
2. Não remover tratamento de timeout do dispatcher (`requestWithTimeout`).
3. Não remover fallback de listeners de QR/status e limpeza de sessão em `exit`.
4. Não remover o tratamento centralizado de erro (`safeCoreEvent` / `withCoreErrorBoundary`).
5. Novos comportamentos devem ser implementados por extensão externa (decorator/facade), sem alterar o núcleo.
