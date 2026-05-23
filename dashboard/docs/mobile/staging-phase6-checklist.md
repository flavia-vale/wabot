# Mobile /m — Phase 6 staging checklist (3006)

## Objetivo
Validar estados de carregamento/erro/vazio e robustez de UX nas telas de Operação.

## Cenários
1. Abrir `http://178.105.54.0:3006/m/op/sends?view=mobile`.
2. Confirmar skeleton de carregamento breve antes da lista de envios.
3. Alternar tabs (Na fila / Enviados / Falhas) e validar transição de estado.
4. Abrir `http://178.105.54.0:3006/m/op/logs?view=mobile`.
5. Confirmar skeleton de carregamento breve antes da lista de logs.
6. Usar busca para obter lista vazia e validar `MobileStateCard` de "Nenhum log encontrado".
7. Validar acessibilidade básica: navegação por foco nos filtros/tabs e leitura de labels.

## Resultado esperado
- Estados carregando/vazio renderizam sem quebra visual.
- Nenhuma chamada nova de API foi introduzida.
- Navegação `/m` segue estável em staging porta 3006.
