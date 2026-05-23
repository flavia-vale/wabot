# Mobile /m — Phase 5 staging checklist (3006)

## Objetivo
Validar UX mobile sem tocar funcionalidades de backend.

## Cenários
1. Abrir `http://178.105.54.0:3006/m?view=mobile` e confirmar bottom-nav.
2. Navegar para Conversor, Oferta, Envios e Logs.
3. Em Envios, alternar tabs e validar estado vazio quando aplicável.
4. Em Logs, usar busca e filtros para confirmar atualização client-side.
5. Navegar Configuração: WhatsApp, Grupos, Credenciais, Preferências.
6. Navegar Conta: Assinatura.
7. Navegar Ajuda: Tutorial.

## Resultado esperado
- Nenhuma tela deve chamar APIs novas.
- Nenhuma rota deve quebrar layout desktop existente.
- Navegação mobile deve manter consistência via `/m`.
