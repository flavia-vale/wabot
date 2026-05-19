# Checklist de validação — Converte Links (Staging 3006)

URL alvo: `http://178.105.54.0:3006/dashboard/converte-links`

## Objetivo
Validar as fases 4, 5 e 6 de UX/acessibilidade na tela manual de conversão de links.

## Cenários

1. **Guidance de entrada**
   - Confirmar que os chips de ajuda são exibidos:
     - `1 link por linha`
     - `Aceita texto com links`
     - `Máximo 10 links por envio`

2. **Aviso preventivo de texto ruidoso**
   - Colar texto longo (>= 240 chars) sem links suportados.
   - Resultado esperado: aviso âmbar informando que nenhum link suportado foi detectado.

3. **Limites existentes não regrediram**
   - Colar > 10 links suportados.
   - Resultado esperado: erro de limite de links (alerta vermelho).
   - Colar texto > 12.000 caracteres.
   - Resultado esperado: erro de tamanho de texto.

4. **Acessibilidade de feedback**
   - Disparar erro e cópia de link.
   - Resultado esperado: mensagens em área com `aria-live="polite"` sem quebra visual.

5. **Mobile (sticky CTA)**
   - Em viewport mobile, validar visibilidade dos avisos/chips sem overlap do CTA sticky.

## Resultado esperado para aprovação
- Feedback pré-envio mais claro.
- Alertas de erro e sucesso permanecem legíveis e acessíveis.
- Sem impacto no contrato da API, banco ou variáveis de ambiente.
