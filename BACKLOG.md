# Backlog de Issues — wabot

Gerado durante processo de QA. Issues ordenadas por módulo e prioridade.  
**Status:** `open` · `in-progress` · `done`

---

## Módulo 1 — Autenticação

### BUG-001 · Sem validação de formato de email no registro
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `src/api/routes/auth.js` — `POST /register`

**Descrição:**  
O endpoint aceita qualquer string como email, incluindo valores sem `@` (ex: `"nao-e-email"`). O usuário é criado normalmente e recebe token válido.

**Reprodução:**
```bash
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalido","password":"senha123"}'
# → 200 OK, usuário criado
```

**Impacto:** Usuários cadastrados com email inutilizável não conseguem recuperar senha nem receber notificações. Poluição no banco de dados.

**Correção sugerida:** Adicionar validação de formato antes de criar o usuário:
```js
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) return reply.code(400).send({ error: 'Formato de email inválido' })
```

---

### BUG-002 · Sem validação de tamanho mínimo de senha
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `src/api/routes/auth.js` — `POST /register`

**Descrição:**  
O endpoint aceita senhas de qualquer tamanho, incluindo senhas de 1 caractere. Não há política de senha mínima.

**Reprodução:**
```bash
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@wabot.com","password":"1"}'
# → 200 OK, usuário criado com senha "1"
```

**Impacto:** Contas com senhas trivialmente fracas são um risco de segurança direto.

**Correção sugerida:**
```js
if (password.length < 8) return reply.code(400).send({ error: 'Senha deve ter no mínimo 8 caracteres' })
```

---

### UX-001 · Login case-sensitive para email
**Status:** done  
**Prioridade:** média  
**Arquivo:** `src/api/routes/auth.js` — `POST /login`

**Descrição:**  
O login diferencia maiúsculas/minúsculas no email. Um usuário cadastrado como `teste@wabot.com` não consegue logar com `TESTE@WABOT.COM` ou `Teste@Wabot.Com`.

**Reprodução:**
```bash
# Cadastro com minúsculo → OK
# Login com maiúsculo → 401 "Credenciais inválidas"
curl -X POST /api/auth/login \
  -d '{"email":"TESTE@WABOT.COM","password":"senha123"}'
```

**Impacto:** UX ruim — comportamento não esperado pelo usuário médio. Emails são case-insensitive por RFC 5321.

**Correção sugerida:** Normalizar email para lowercase antes de buscar no banco, tanto no registro quanto no login:
```js
const normalizedEmail = email.toLowerCase()
```

---

## Módulo 2 — Sessão WhatsApp

### BUG-003 · `wa-groups` retorna `[]` silenciosamente quando WhatsApp não está conectado
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `src/manager.js:28`  
**Endpoint:** `GET /api/session/wa-groups`

**Descrição:**  
Quando o bot está iniciado mas o QR ainda não foi escaneado (`activeSock = null`), o worker envia `{ data: [], error: "Bot não conectado" }`. O manager ignora o campo `error` e resolve a Promise com `[]`, fazendo a rota retornar uma lista vazia em vez de um erro explicativo.

**Reprodução:**
```bash
POST /api/session/start   # bot inicia, aguarda QR
GET  /api/session/wa-groups
# → [] (esperado: 400 "Bot não conectado")
```

**Root cause:** `src/manager.js` linha 28 — handler do tipo `groups` não verifica `msg.error`:
```js
// ATUAL (bug):
if (msg.type === 'groups' && msg.requestId) {
  const pending = pendingRequests.get(msg.requestId)
  if (pending) { pending.resolve(msg.data); pendingRequests.delete(msg.requestId) }
}

// CORRETO:
if (msg.type === 'groups' && msg.requestId) {
  const pending = pendingRequests.get(msg.requestId)
  if (pending) {
    if (msg.error) pending.reject(new Error(msg.error))
    else pending.resolve(msg.data)
    pendingRequests.delete(msg.requestId)
  }
}
```

**Impacto:** Usuário vê lista vazia e não entende que precisa escanear o QR primeiro.

---

### BUG-004 · `wa-groups` trava 10 segundos quando bot acabou de ser parado
**Status:** done  
**Prioridade:** média  
**Arquivo:** `src/manager.js:75` + `src/api/routes/session.js`  
**Endpoint:** `GET /api/session/wa-groups`

**Descrição:**  
Após `POST /session/stop`, o processo worker demora alguns milissegundos para terminar e remover a entrada do `bots` Map via `proc.on('exit')`. Se `wa-groups` for chamado nesse intervalo, a rota envia a requisição para o processo que está encerrando e aguarda 10 segundos até o timeout.

**Reprodução:**
```bash
POST /api/session/stop
GET  /api/session/wa-groups   # imediatamente após
# → aguarda 10s → "Timeout ao buscar grupos"
```

**Root cause:** `isRunning()` checa `bots.has(userId)`, mas a entrada só é removida depois que o processo filho dispara o evento `exit`. Há uma janela de corrida entre `stop` e a limpeza do Map.

**Correção sugerida:** Remover a entrada do Map imediatamente no `stopBot()`, antes do processo terminar:
```js
export function stopBot(userId) {
  const entry = bots.get(userId)
  if (!entry) return false
  bots.delete(userId)  // remover imediatamente
  try { entry.proc.send({ type: 'stop' }) } catch {}
  return true
}
```

**Impacto:** UX ruim — requisição congela o cliente por 10s sem feedback.

---

## Módulo 3 — Grupos

### BUG-005 · POST /api/groups aceita campos com apenas espaços
**Status:** done
**Prioridade:** alta
**Arquivo:** `src/api/routes/groups.js` — `POST /`

**Descrição:**
`!name` é `false` para `" "` (string só com espaço), então a validação deixa passar. Sem `trim()`, valores com espaços entram no banco. Mesmo problema para `waJid`.

**Reprodução:**
```bash
curl -X POST /api/groups \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"waJid":"  ","name":"  ","role":"monitor"}'
# → 200 OK, grupo criado com JID e nome de espaços
```

**Root cause:** Validação usa `!waJid || !name` sem `.trim()` antes.

**Impacto:** Grupos com nomes/JIDs inválidos entram no banco e o bot nunca os matcheia.

**Correção sugerida:**
```js
const trimmedJid = waJid?.trim()
const trimmedName = name?.trim()
if (!trimmedJid || !trimmedName || !role) return reply.code(400).send({ error: 'waJid, name e role obrigatórios' })
// usar trimmedJid e trimmedName no create
```

---

### BUG-006 · Erros de deleteGroup, addFromWA e load() são silenciados no frontend
**Status:** done
**Prioridade:** alta
**Arquivo:** `dashboard/app/dashboard/grupos/page.js` — `handleDelete`, `handleAddFromWA`, `load()`

**Descrição:**
Os três handlers usam `catch {}` vazio. Se qualquer operação falhar (erro de rede, 409 duplicado, 404), o usuário não recebe nenhum feedback — a UI simplesmente não reage.

**Root cause:**
```js
async function handleDelete(id) {
  try { await api.deleteGroup(id); await load() } catch {}  // erro silenciado
}
async function handleAddFromWA(g, role) {
  try { await api.addGroup(g.waJid, g.name, role); await load() } catch {}  // idem
}
async function load() {
  try { setGroups(await api.groups()) } catch {}  // idem
}
```

**Impacto:** Falhas silenciosas confundem o usuário — clicar em "Remover" pode não fazer nada sem feedback.

**Correção sugerida:** Adicionar estado de erro (`setError`) nesses handlers e exibir na UI, similar ao padrão já usado em `handleAdd`.

---

### UX-002 · Remover grupo sem confirmação
**Status:** done
**Prioridade:** média
**Arquivo:** `dashboard/app/dashboard/grupos/page.js` — `handleDelete`

**Descrição:**
Clique em "Remover" deleta imediatamente, sem confirmação. Deleção acidental não tem desfazer.

**Correção sugerida:** Adicionar `if (!confirm('Remover este grupo?')) return` ou modal de confirmação.

---

### UX-003 · "Já cadastrado" ignora o role na lista do WhatsApp
**Status:** done
**Prioridade:** baixa
**Arquivo:** `dashboard/app/dashboard/grupos/page.js`

**Descrição:**
`existingJids` é um `Set` de JIDs sem considerar role. Um grupo cadastrado como "monitor" aparece como "(já cadastrado)" na lista do WA, escondendo o botão "Postar" — o usuário não consegue adicioná-lo também como post, mesmo que o schema permita (`@@unique([userId, waJid, role])`).

**Root cause:**
```js
const existingJids = new Set(groups.map(g => g.waJid))  // ignora role
const already = existingJids.has(g.waJid)               // bloqueia ambos os roles
```

**Correção sugerida:**
```js
const existingJidRoles = new Set(groups.map(g => `${g.waJid}::${g.role}`))
const monitorAlready = existingJidRoles.has(`${g.waJid}::monitor`)
const postAlready    = existingJidRoles.has(`${g.waJid}::post`)
// esconder botão individualmente por role
```

---

## Módulo 4 — Credenciais

### BUG-007 · Credenciais salvas não aparecem nos campos ao reabrir a página
**Status:** done
**Prioridade:** alta
**Arquivo:** `dashboard/app/dashboard/credenciais/page.js` — `PlatformCard`

**Descrição:**
Bug clássico de React: `useState(initialData ?? {})` inicializa o estado uma única vez, no primeiro render. Quando a página carrega, `credMap` ainda é `{}` (vazio), então `initialData` é `undefined` e os campos ficam vazios. O `useEffect` do pai pega as credenciais do banco e atualiza `credMap`, mas o `PlatformCard` já foi montado — a mudança de prop não dispara re-inicialização do `useState`.

**Resultado:** Usuário abre a página e vê todos os campos em branco mesmo tendo credenciais salvas.

**Root cause:**
```js
// PlatformCard
const [values, setValues] = useState(initialData ?? {})  // só inicializa uma vez
```

**Correção sugerida:**
```js
useEffect(() => {
  if (initialData) setValues(initialData)
}, [initialData])
```

---

### BUG-008 · PUT /api/credentials/:platform não valida campos obrigatórios por plataforma
**Status:** done
**Prioridade:** média
**Arquivo:** `src/api/routes/credentials.js` — `PUT /:platform`

**Descrição:**
`req.body` é serializado diretamente sem validar quais campos são obrigatórios. `{}` ou `{ foo: "bar" }` são aceitos como credencial válida. Quando o bot tentar usar a credencial incompleta, a conversão falha silenciosamente.

**Correção sugerida:**
```js
const REQUIRED = {
  shopee:        ['appId', 'secretKey'],
  amazon:        ['tag'],
  mercadolivre:  ['tag', 'ssid'],
  magazineluiza: ['tag'],
}
const missing = REQUIRED[platform].filter(f => !req.body?.[f]?.toString().trim())
if (missing.length) return reply.code(400).send({ error: `Campos obrigatórios: ${missing.join(', ')}` })
```

---

## Módulo 5 — Configurações do Bot

### BUG-009 · Validação de delayMin/delayMax usa comparação de strings
**Status:** done
**Prioridade:** alta
**Arquivo:** `dashboard/app/dashboard/configuracoes/page.js` — `handleSave`

**Descrição:**
`e.target.value` de um `<input type="number">` retorna string. Após o usuário editar ambos os campos, `form.delayMin` e `form.delayMax` ficam como strings. A comparação `form.delayMin > form.delayMax` passa a ser lexicográfica — `"5" > "15"` é `true` (porque "5" > "1"), causando falso positivo exatamente na combinação 5/15 recomendada pela própria UI.

**Reprodução:**
1. Abrir Configurações (campos carregam como numbers — OK)
2. Apagar e redigitar "5" no campo Mínimo e "15" no Máximo
3. Clicar Salvar → exibe "Delay mínimo não pode ser maior que o máximo" mesmo sendo válido

**Root cause:**
```js
if (form.delayMin > form.delayMax) { /* string comparison após edição */ }
```

**Correção sugerida:**
```js
if (Number(form.delayMin) > Number(form.delayMax)) { ... }
```

---

### BUG-010 · Backend não valida range de delayMin/delayMax
**Status:** done
**Prioridade:** baixa
**Arquivo:** `src/api/routes/config.js` — `PUT /`

**Descrição:**
O `<input>` HTML tem `min="0" max="300"`, mas o backend aceita qualquer valor inteiro. Requisição direta pode enviar `delayMin: -100` ou `delayMax: 99999`, que são gravados no banco e usados pelo bot em `setTimeout`.

**Correção sugerida:**
```js
if (delayMin !== undefined && (delayMin < 0 || delayMin > 300))
  return reply.code(400).send({ error: 'delayMin deve ser entre 0 e 300' })
if (delayMax !== undefined && (delayMax < 0 || delayMax > 300))
  return reply.code(400).send({ error: 'delayMax deve ser entre 0 e 300' })
if (delayMin !== undefined && delayMax !== undefined && delayMin > delayMax)
  return reply.code(400).send({ error: 'delayMin não pode ser maior que delayMax' })
```

---

## Módulo 6 — Envio e Agendamento

### BUG-011 · `loadScheduled` e `handleCancel` silenciam erros
**Status:** done
**Prioridade:** alta
**Arquivo:** `dashboard/app/dashboard/envio/page.js` — `loadScheduled`, `handleCancel`

**Descrição:**
Mesma classe do BUG-006. `catch {}` vazio em ambas as funções — erros de rede ou do servidor desaparecem sem nenhum feedback para o usuário.

**Root cause:**
```js
async function loadScheduled() {
  try { setScheduled(await api.scheduledList()) } catch {}
}
async function handleCancel(id) {
  try { await api.scheduledCancel(id); await loadScheduled() } catch {}
}
```

**Correção sugerida:** Adicionar estado de erro e exibir na UI.

---

### BUG-012 · `GET /scheduled` retorna `targetJids` como string JSON não parseada
**Status:** done
**Prioridade:** baixa
**Arquivo:** `src/api/routes/broadcast.js` — `GET /scheduled` e `POST /scheduled`

**Descrição:**
`targetJids` é salvo como `JSON.stringify(array)` e retornado cru. Inconsistente com o padrão de `credentials.js` que faz `JSON.parse` antes de retornar. O frontend atual não exibe `targetJids`, mas qualquer consumidor futuro da API precisará fazer o parse manualmente.

**Correção sugerida:**
```js
return msgs.map(m => ({ ...m, targetJids: JSON.parse(m.targetJids) }))
```

---

### UX-004 · `handleCancel` cancela agendamento sem confirmação
**Status:** done
**Prioridade:** média
**Arquivo:** `dashboard/app/dashboard/envio/page.js`

**Descrição:**
Clique em "Cancelar" age imediatamente, sem confirmação. Cancelamento de mensagem agendada não tem desfazer.

**Correção sugerida:** Adicionar `if (!confirm('Cancelar este agendamento?')) return` ou modal.

---

## Módulo 7 — Pagamentos (MP)

### SEC-001 · Webhook HMAC bypass — X-Signature ausente pula a validação
**Status:** done
**Prioridade:** crítica
**Arquivo:** `src/api/routes/payments.js` — `POST /webhook`

**Descrição:**
O código valida o HMAC apenas se `ts` e `v1` existirem no header `X-Signature`. Se o header estiver ausente, ambas as variáveis ficam `undefined`, o `if (ts && v1)` é `false` e a validação é completamente ignorada.

**Impacto:** Atacante que conhece um `userId` pode fazer POST direto ao `/webhook` sem `X-Signature` e ativar plano Pro para qualquer usuário. Permite account escalation via HTTP.

**Root cause:**
```js
// ATUAL — se X-Signature ausente: ts=undefined, v1=undefined → pula tudo
if (ts && v1) { /* valida HMAC */ }

// CORRETO:
if (!ts || !v1) return reply.code(401).send({ error: 'Assinatura ausente' })
// então valida HMAC
```

---

### BUG-013 · Webhook sem try/catch — userId inexistente gera P2025 e 500
**Status:** done
**Prioridade:** média
**Arquivo:** `src/api/routes/payments.js` — `POST /webhook`

**Descrição:**
`db.user.update({ where: { id: userId } })` lança `P2025` se o userId não existir no banco (ex: usuário deletado após compra). Sem try/catch, o webhook retorna 500 e o MercadoPago reenvia indefinidamente.

**Correção sugerida:** Verificar existência do usuário antes do update, ou envolver as operações de banco em try/catch.

---

### UX-005 · `handleCheckout` usa `alert()` — inconsistente com padrão do app
**Status:** done
**Prioridade:** baixa
**Arquivo:** `dashboard/app/dashboard/planos/page.js`

**Descrição:**
Todos os outros handlers exibem erros com `<p className="text-red-500">`. Apenas o checkout usa `alert()`.

---

### UX-006 · `load()` em Planos silencia erros — página fica em branco
**Status:** done
**Prioridade:** baixa
**Arquivo:** `dashboard/app/dashboard/planos/page.js`

**Descrição:**
`catch {}` vazio em `load()`. Se falhar, `data` fica `null` e a página renderiza sem conteúdo, sem nenhuma mensagem de erro para o usuário.

---

## Módulo 8 — Lógica do Bot

### BUG-014 · GraphQL injection no converter Shopee
**Status:** done
**Prioridade:** média
**Arquivo:** `src/converters/shopee.js`

**Descrição:**
A URL é interpolada diretamente na string GraphQL sem escape. O `detector.js` remove `"` apenas no **final** da URL — uma URL com `"` no meio (ex: `https://shopee.com.br/p?id=1"}){}`) pode quebrar o query ou injetar fragmentos GraphQL.

**Root cause:**
```js
query: `mutation {
  generateShortLink(input: { originUrl: "${url}", subIds: [""] }) { ... }
}`
```

**Correção sugerida:**
```js
originUrl: "${url.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"
```

---

### BUG-015 · Reconexão sem backoff — risco de ban do número WA
**Status:** done
**Prioridade:** baixa
**Arquivo:** `src/bot-worker.js:184`

**Descrição:**
`if (shouldReconnect) startBot()` reconecta imediatamente sem delay. Se o servidor WA rejeitar repetidamente (ban temporário, instabilidade), o bot tenta em loop fechado, podendo agravar o ban.

**Correção sugerida:**
```js
if (shouldReconnect) setTimeout(startBot, 5_000)
```

---

## Módulo 9 — Indicação (Referral)

### BUG-016 · Página de login não lê `?ref=` da URL — link de indicação não funciona
**Status:** done
**Prioridade:** alta
**Arquivo:** `dashboard/app/login/page.js` + `dashboard/lib/api.js`

**Descrição:**
O link compartilhado é `/login?ref=CODIGO`. Mas a página de login não usa `useSearchParams` para capturar o parâmetro, e `api.register` não aceita `ref`. O indicador nunca recebe os +7 dias — o sistema de referral é inoperante pela UI.

**Root cause:**
```js
// api.js — ref nunca é passado
register: (email, password) =>
  apiFetch('/api/auth/register', { ..., body: JSON.stringify({ email, password }) })
```

**Correção sugerida:**
```js
// login/page.js (dentro de componente com Suspense)
const ref = useSearchParams().get('ref')
// ...
await api.register(email, password, ref)

// api.js
register: (email, password, ref) =>
  apiFetch('/api/auth/register', { ..., body: JSON.stringify({ email, password, ...(ref && { ref }) }) })
```

---

### BUG-017 · Sem limite de uso do código de referral — abuso de acesso infinito
**Status:** done
**Prioridade:** alta
**Arquivo:** `src/api/routes/auth.js` — `POST /register`

**Descrição:**
Nenhum limite de quantas contas podem usar o mesmo `ref`. Um atacante pode criar N contas (agravado pelo BUG-001 que aceita e-mails inválidos) usando o mesmo código e dar ao referrer `N × 7 dias` de acesso gratuito.

**Correção sugerida:** Contar usos do código (campo `referralUseCount` no `User`) e limitar a um máximo (ex: 20), ou exigir confirmação de e-mail antes de conceder o benefício.

---

## Módulo 10 — Dashboard (UI / Shell)

### BUG-018 · Token expirado/inválido não detectado — sem auto-redirect para login
**Status:** done
**Prioridade:** média
**Arquivo:** `dashboard/lib/api.js`

**Descrição:**
O layout apenas verificava se o token existia no localStorage, não se era válido. Token expirado causava 401 em todas as chamadas, mas os `catch {}` silenciosos deixavam o usuário preso no dashboard com páginas em branco.

**Correção:** Interceptar 401 em `apiFetch`, limpar token e redirecionar para `/login`.

---

### BUG-019 · WS não fechado após status "connected"
**Status:** done
**Prioridade:** baixa
**Arquivo:** `dashboard/app/dashboard/page.js`

**Descrição:**
Após conectar, o WebSocket continua aberto indefinidamente. Deveria ser fechado com `wsRef.current?.close()` quando `msg.data === 'connected'`.

---

### UX-007 · `<html lang="en">` em app inteiramente em português
**Status:** done
**Prioridade:** baixa
**Arquivo:** `dashboard/app/layout.js:7`

**Descrição:**
Afeta leitores de tela e ferramentas de tradução automática. Correção: `lang="pt-BR"`.

---

## Como adicionar novas issues

Ao encontrar novos bugs durante o QA, adicionar neste arquivo seguindo o padrão:

```markdown
### BUG-XXX · Título curto
**Status:** open
**Prioridade:** alta | média | baixa
**Arquivo:** caminho/do/arquivo.js — função ou endpoint afetado

**Descrição:** O que acontece de errado.

**Reprodução:** Passo a passo mínimo para reproduzir.

**Root cause:** Onde e por que o bug ocorre no código.

**Impacto:** Consequência para o usuário ou sistema.

**Correção sugerida:** Trecho de código ou abordagem recomendada.
```
