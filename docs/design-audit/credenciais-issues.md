# Issues de Design — Credenciais

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/credenciais/page.js`, responsável por configurar credenciais de afiliado por plataforma.

## Issue 1 — Mascarar campos sensíveis por padrão

**Tipo:** Segurança percebida / Acessibilidade / UI  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
Campos sensíveis como `secretKey`, `ssid` e `csrf` são renderizados como inputs de texto comuns. Isso pode expor chaves, cookies e tokens em tela compartilhada ou durante suporte remoto.

### Impacto no usuário
- Usuário pode expor credenciais privadas acidentalmente.
- A tela transmite baixa segurança percebida para dados críticos.
- A confiança no painel diminui, especialmente em campos como Secret Key, SSID e CSRF.

### Critérios de aceite
- Campos sensíveis devem ser mascarados por padrão.
- Deve existir forma acessível de mostrar/ocultar o valor quando necessário.
- O botão de mostrar/ocultar deve ter `aria-label` claro.
- Campos não sensíveis devem continuar como texto normal.
- Rodar lint e build após a alteração.

### Sugestão de solução
Adicionar metadado nos campos:

```js
{ key: 'secretKey', label: 'Secret Key', sensitive: true }
```

E renderizar:

```jsx
type={f.sensitive && !visibleFields[f.key] ? 'password' : 'text'}
```

---

## Issue 2 — Sincronizar `initialData` no `PlatformCard`

**Tipo:** Bug UX / Estado de formulário  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
`PlatformCard` inicializa `values` com `initialData`, mas não sincroniza o estado local quando `initialData` muda depois do carregamento assíncrono. Como os cards são renderizados durante loading, existe risco de os formulários permanecerem vazios mesmo após `credMap` receber dados.

### Impacto no usuário
- Credenciais salvas podem não aparecer corretamente.
- Usuário pode sobrescrever dados existentes com valores vazios sem perceber.
- A tela pode transmitir que nada está configurado mesmo quando há dados salvos.

### Critérios de aceite
- Quando `initialData` mudar, o estado local do card deve refletir os novos dados.
- Não sobrescrever alterações locais enquanto o usuário está editando ativamente, se houver recarregamento posterior.
- Cards devem exibir credenciais carregadas de forma consistente.
- Rodar lint e build após a alteração.

### Sugestão de solução
Adicionar sincronização controlada:

```js
useEffect(() => {
  setValues(initialData ?? {})
}, [initialData])
```

Alternativa: renderizar cards apenas após carregamento concluído com sucesso.

---

## Issue 3 — Exibir status de configuração por plataforma

**Tipo:** UX / Visibilidade de status  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
A tela não mostra rapidamente se cada plataforma está configurada, incompleta ou pendente. O usuário precisa inferir pelo conteúdo dos campos.

### Impacto no usuário
- Usuário demora para entender quais plataformas ainda precisam de ação.
- Onboarding fica menos guiado.
- Pode haver falsa sensação de configuração completa.

### Critérios de aceite
- Cada card deve exibir badge de status.
- Status sugeridos: `Configurado`, `Incompleto`, `Pendente`.
- Critérios de status devem considerar os campos exigidos por plataforma.
- Mercado Livre só deve aparecer como configurado quando Tag, SSID e CSRF estiverem preenchidos.

### Sugestão de solução
Criar função utilitária:

```js
function getPlatformStatus(platform, values) {
  const required = platform.fields.filter((f) => f.required !== false)
  const filled = required.filter((f) => values[f.key]?.trim())
  if (filled.length === 0) return 'pending'
  if (filled.length < required.length) return 'incomplete'
  return 'configured'
}
```

---

## Issue 4 — Adicionar validação client-side de campos obrigatórios por plataforma

**Tipo:** UX / Prevenção de erro / Formulário  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
O botão “Salvar” permite enviar valores vazios ou incompletos. Isso é especialmente crítico no Mercado Livre, onde a própria interface informa que Tag, SSID e CSRF são obrigatórios.

### Impacto no usuário
- Usuário pode salvar uma configuração que não funcionará.
- Erros podem aparecer apenas durante a conversão de links, longe do ponto de configuração.
- Aumenta suporte e retrabalho.

### Critérios de aceite
- Validar campos obrigatórios antes de chamar a API.
- Exibir erro próximo ao campo ou no topo do card.
- Manter validação alinhada com regras reais do backend.
- Permitir salvar plataformas com campos opcionais somente quando isso fizer sentido.

### Sugestão de solução
Marcar campos obrigatórios no metadata e validar no `handleSubmit`:

```js
const missing = platform.fields.filter((f) => f.required !== false && !values[f.key]?.trim())
```

---

## Issue 5 — Melhorar exibição de erro por card

**Tipo:** Acessibilidade / Feedback de sistema / UI  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`
- `dashboard/components/Alert.js`

### Problema
Erros de salvamento aparecem como texto vermelho simples dentro do card. A mensagem tem baixa hierarquia visual e não usa semântica acessível explícita.

### Impacto no usuário
- Erros podem passar despercebidos.
- Leitores de tela podem não anunciar a falha adequadamente.
- A tela fica inconsistente com outros pontos que usam componentes de feedback.

### Critérios de aceite
- Erros por card devem usar `Alert` ou bloco com `role="alert"`.
- Mensagem deve indicar a plataforma afetada.
- Deve haver orientação acionável, por exemplo “verifique os campos e tente novamente”.
- O erro deve ser limpo ao tentar salvar novamente.

### Sugestão de solução
Usar um alerta local:

```jsx
{error && <Alert type="error" title={`Falha ao salvar ${platform.label}`} message={error} />}
```

---

## Issue 6 — Mover aviso específico do Mercado Livre para dentro do card correspondente

**Tipo:** UX Writing / Hierarquia de informação  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
A tela exibe um aviso global sobre Mercado Livre antes dos cards, mas a ação relacionada acontece dentro do card Mercado Livre. Isso separa contexto e ação.

### Impacto no usuário
- Usuário pode não associar o aviso aos campos corretos.
- A mensagem ocupa espaço global mesmo quando o usuário está configurando outra plataforma.
- O card Mercado Livre perde oportunidade de orientar no ponto exato da ação.

### Critérios de aceite
- Aviso específico do Mercado Livre deve aparecer dentro do card Mercado Livre ou próximo aos campos relacionados.
- Se houver aviso global, ele deve ser genérico sobre credenciais/plataformas.
- A copy deve permanecer curta e clara.

### Sugestão de solução
Mover a mensagem:

```text
Para gerar link curto correto (meli.la), preencha Tag, SSID e CSRF.
```

para dentro do card Mercado Livre.

---

## Issue 7 — Adicionar ajuda “Como encontrar?” para campos técnicos

**Tipo:** UX Writing / Ajuda contextual / Educação do usuário  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
Hints como “Valor do cookie ssid” e “Valor do cookie _csrf” são técnicos e podem não ser suficientes para usuários não familiarizados com cookies ou ferramentas de navegador.

### Impacto no usuário
- Usuário pode travar na configuração do Mercado Livre.
- Aumenta necessidade de suporte manual.
- Campos técnicos geram insegurança e risco de erro.

### Critérios de aceite
- Campos técnicos devem ter link, tooltip, accordion ou modal “Como encontrar?”.
- Ajuda deve ser curta e específica para cada campo.
- Não expor práticas inseguras sem alerta de cuidado.
- Conteúdo deve ser validado com o fluxo real da plataforma.

### Sugestão de solução
Adicionar metadados opcionais:

```js
{ key: 'ssid', label: 'SSID (cookie)', help: 'Como encontrar o SSID?' }
```

E renderizar um link/accordion abaixo do hint.

---

## Issue 8 — Reforçar benefício da tela no título/subtítulo

**Tipo:** UX Writing / Clareza de valor  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
O subtítulo “Configure suas contas de afiliado por plataforma” é claro, mas não conecta a configuração ao resultado do produto: converter links com as tags do usuário.

### Impacto no usuário
- Usuário entende a ação, mas não vê imediatamente o benefício.
- A tela parece mais técnica do que orientada a resultado.
- Pode reduzir motivação para completar a configuração.

### Critérios de aceite
- Subtítulo deve explicar o resultado esperado da configuração.
- Copy deve ser curta e clara.
- Não alterar a arquitetura da tela.

### Sugestão de solução
Trocar para:

```text
Adicione suas credenciais para que o bot converta links usando suas tags de afiliado.
```

---

## Issue 9 — Desabilitar campos durante salvamento por card

**Tipo:** UX / Prevenção de erro / Feedback de sistema  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
Durante `saving`, o botão muda para “Salvando...”, mas os inputs continuam editáveis. Usuário pode alterar valores enquanto a requisição está em andamento, criando diferença entre o que foi enviado e o que aparece no campo.

### Impacto no usuário
- Usuário pode acreditar que salvou valores que foram digitados depois do submit.
- A tela pode gerar confusão em conexões lentas.
- Risco de estado visual divergente do estado persistido.

### Critérios de aceite
- Inputs do card devem ficar desabilitados durante o salvamento daquele card.
- Botão deve continuar indicando “Salvando...”.
- Outros cards podem permanecer editáveis, se tecnicamente seguro.

### Sugestão de solução
Adicionar `disabled={saving || disabled}` aos inputs e selects do card.

---

## Issue 10 — Informar política de armazenamento/uso de credenciais sensíveis

**Tipo:** Confiança / Segurança percebida / UX Writing  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Credenciais  
**Arquivos relacionados:**
- `dashboard/app/dashboard/credenciais/page.js`

### Problema
A tela solicita dados sensíveis, mas não informa como esses dados serão usados ou protegidos. Mesmo que a segurança técnica exista no backend, a interface não comunica confiança.

### Impacto no usuário
- Usuário pode hesitar em preencher Secret Key, SSID ou CSRF.
- A percepção de risco aumenta.
- Pode reduzir conclusão do setup.

### Critérios de aceite
- Exibir mensagem curta sobre uso das credenciais.
- Mensagem deve ser verdadeira e alinhada com implementação real.
- Não prometer criptografia/armazenamento seguro se isso não estiver implementado.

### Sugestão de solução
Adicionar aviso discreto:

```text
Esses dados são usados apenas para gerar seus links de afiliado. Não compartilhe suas credenciais fora do painel.
```

Se houver criptografia/segredo no backend, comunicar com precisão.
