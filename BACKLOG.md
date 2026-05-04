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


### UX-008 · Card "Carregar grupos existentes" deve ser o primeiro da página
**Status:** closed
**Prioridade:** média
**Arquivo:** `dashboard/app/dashboard/grupos/page.js`

**Descrição:**
A ordem atual dos cards na página de Grupos é: [Monitorar] → [Postar] → [Carregar do WhatsApp] → [Adicionar manualmente]. O fluxo natural para um usuário novo é primeiro carregar os grupos do WhatsApp e depois classificá-los — o card de importação deveria preceder os cards de listagem.

**Ordem correta:**
1. Carregar grupos existentes (importação do WhatsApp)
2. Monitorar (origem)
3. Postar (destino)
4. Adicionar manualmente (oculto — ver UX-009)

**Correção:** Mover o bloco `{/* Carregar grupos do WhatsApp */}` para antes dos blocos `{/* Grupos monitorados */}` e `{/* Grupos de postagem */}` no JSX de `GruposPage`.

---

### UX-009 · Card "Adicionar manualmente" deve ser ocultado
**Status:** closed
**Prioridade:** média
**Arquivo:** `dashboard/app/dashboard/grupos/page.js`

**Descrição:**
O formulário de adição manual exige que o usuário saiba o JID técnico do grupo (ex: `120363421377996844@g.us`), informação que não é acessível na interface do WhatsApp comum. Na prática, todos os grupos devem ser adicionados via importação do WhatsApp (card "Carregar grupos existentes"). O card de adição manual é inútil para o usuário final e polui a página.

**Root cause:** O card foi criado como alternativa de fallback para quando o bot está desconectado, mas o JID não é informação que o usuário consegue obter facilmente — tornando o fallback inaplicável.

**Correção:** Remover o bloco JSX `{/* Formulário manual */}` e os estados/handlers associados (`form`, `error`, `loading`, `handleAdd`).

---

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

### BUG-020 · Página `/dashboard/logs` retorna 404 em produção
**Status:** closed
**Prioridade:** alta
**Arquivo:** `dashboard/app/dashboard/logs/page.js`

**Descrição:**
Ao acessar `/dashboard/logs` no servidor de produção, o Next.js retorna "This page could not be found." (404). Localmente a página existe e está corretamente implementada — `page.js`, rota backend `/api/logs`, registro no `server.js` e métodos em `lib/api.js` estão todos presentes.

**Root cause:**
O build de produção do dashboard (`.next/`) foi gerado antes do commit `d96489d` (FEAT-003) chegar ao servidor. O `npm run build` pode ter sido executado antes do `git pull` incluir esse commit, ou o build falhou silenciosamente e o `pm2 restart dashboard` subiu com o artefato antigo — que não continha a rota `/dashboard/logs`.

**Reprodução:**
1. Acessar `http://178.105.54.0/dashboard/logs` → "This page could not be found."
2. Acessar `/dashboard/envio` ou outras páginas → funcionam normalmente (build antigo)

**Correção:**
Rodar os comandos de rebuild no servidor SSH:
```bash
cd ~/wabot && git pull
cd dashboard && npm run build && cd ..
pm2 restart all
```
Verificar que o build termina sem erro antes de reiniciar. Após `pm2 restart`, religar o bot no dashboard (novo QR).

---

---

## Módulo 11 — Features F5 (Polish & Novas Funcionalidades)


---

### FEAT-001 · Modo de imagem por grupo monitorado

**Status:** done  
**Prioridade:** alta  
**Inspiração:** proafiliados.shop — opções `prioritize_preview`, `fallback_to_original_image`, `original_image_as_preview`

**Descrição:**  
Atualmente o bot envia apenas texto com o link convertido. O concorrente envia imagem do produto + texto + link como mensagem de imagem no WhatsApp, gerando muito mais engajamento. A feature permite configurar por grupo monitorado como a imagem da mensagem de saída deve ser tratada.

**Motivação do design:**  
Mensagens com múltiplos links (ex: link de produto + link de cupom) exigem que o usuário escolha qual link usar para buscar a imagem — não é possível simplesmente usar a imagem de cada link porque nem todo link é de produto.

---

#### Modos de imagem (mutuamente exclusivos)

| Modo | Valor | Comportamento |
|------|-------|---------------|
| Nenhuma | `none` | Comportamento atual — só texto |
| Original | `original` | Usa a imagem que veio na mensagem monitorada (se houver) |
| Buscar no site | `fetch` | Faz scraping da imagem do produto no site da loja |

Quando modo = `fetch`, dois parâmetros extras:
- **`imageLinkTarget`** (`first` \| `last`) — qual link da mensagem usar para o scraping
- **`fallbackToOriginal`** (boolean) — se o scraping falhar, tenta usar a imagem original da mensagem

---

#### Lógica de envio (bot-worker.js)

```
modo "none"     → sock.sendMessage(jid, { text: finalText })   ← atual

modo "original" → se msg tiver imageMessage:
                    sock.sendMessage(jid, { image: { url: imageUrl }, caption: finalText })
                  senão:
                    sock.sendMessage(jid, { text: finalText })

modo "fetch"    → url = links[0] ou links[-1] conforme imageLinkTarget
                  imageUrl = await fetchProductImage(platform, url)
                  se imageUrl:
                    sock.sendMessage(jid, { image: { url: imageUrl }, caption: finalText })
                  senão se fallbackToOriginal e msg tem imageMessage:
                    sock.sendMessage(jid, { image: { url: originalImageUrl }, caption: finalText })
                  senão:
                    sock.sendMessage(jid, { text: finalText })
```

---

#### Alterações necessárias

**1. Prisma schema — tabela `Group`**

Adicionar campos:
```prisma
model Group {
  // campos existentes ...
  imageMode          String  @default("none")   // "none" | "original" | "fetch"
  imageLinkTarget    String  @default("first")  // "first" | "last"
  fallbackToOriginal Boolean @default(false)
}
```

Migration: `npx prisma migrate dev --name add-group-image-mode`

**2. Backend — `src/api/routes/groups.js`**

- `POST /` e `PUT /:id` — aceitar e salvar os 3 novos campos
- Validar `imageMode` ∈ `['none', 'original', 'fetch']`
- Validar `imageLinkTarget` ∈ `['first', 'last']`

**3. Scrapers de imagem — `src/converters/imageScrapers.js` (arquivo novo)**

Uma função por plataforma que recebe a URL do produto e retorna a URL da imagem:

```js
export async function fetchProductImage(platform, productUrl) { ... }
// internamente chama:
async function fetchShopeeImage(url)        // API ou scraping da página
async function fetchMercadoLivreImage(url)  // og:image da página
async function fetchAmazonImage(url)        // og:image ou scraping
async function fetchMagazineluizaImage(url) // og:image da página
async function fetchAliexpressImage(url)    // og:image ou scraping
```

Estratégia recomendada: `GET` na URL do produto, extrair `<meta property="og:image">` — funciona em ML, Amazon, Magalu. Shopee pode exigir abordagem diferente (API ou headless).

**4. bot-worker.js — `src/bot-worker.js`**

- `loadConfig()` passa a incluir `imageMode`, `imageLinkTarget`, `fallbackToOriginal` de cada grupo monitor
- No handler de `messages.upsert`, após construir `finalText`, chamar função auxiliar `buildImageMessage()`:

```js
async function buildImageMessage(finalText, imageMode, imageLinkTarget, fallbackToOriginal, links, originalMsg) {
  if (imageMode === 'none') return { text: finalText }

  if (imageMode === 'original') {
    const imgUrl = extractOriginalImageUrl(originalMsg)
    if (imgUrl) return { image: { url: imgUrl }, caption: finalText }
    return { text: finalText }
  }

  if (imageMode === 'fetch') {
    const targetLink = imageLinkTarget === 'first' ? links[0] : links[links.length - 1]
    const imgUrl = await fetchProductImage(targetLink.platform, targetLink.url)
    if (imgUrl) return { image: { url: imgUrl }, caption: finalText }
    if (fallbackToOriginal) {
      const origUrl = extractOriginalImageUrl(originalMsg)
      if (origUrl) return { image: { url: origUrl }, caption: finalText }
    }
    return { text: finalText }
  }
}
```

**5. Dashboard — `dashboard/app/dashboard/grupos/page.js`**

Expandir o card de cada grupo monitorado para exibir as configurações de imagem:

```
[Grupo monitorado: xet das promoções]
  Papel: Monitor  |  Post
  ─────────────────────────────
  Imagem:
    ○ Nenhuma
    ○ Usar imagem original da mensagem
    ○ Buscar imagem no site
       └ Usar link:  [Primeiro ▾] [Último ▾]
       └ Fallback para original se falhar: [toggle]
```

**6. API `lib/api.js`**

- `addGroup(waJid, name, role, imageMode, imageLinkTarget, fallbackToOriginal)`
- Novo método: `updateGroup(id, data)` — `PUT /api/groups/:id`

---

#### Ordem de implementação recomendada

1. Migration Prisma + backend (rotas grupos)
2. `imageScrapers.js` com og:image para ML/Amazon/Magalu (mais simples)
3. `bot-worker.js` — integrar `buildImageMessage()`
4. Dashboard — UI de configuração por grupo
5. Scraper Shopee (mais complexo, pode vir depois)

---

#### Riscos e observações

- **Shopee** bloqueia scraping por browser fingerprint — pode exigir puppeteer/headless ou uso da API de afiliados (que já retorna `item_url` com imagem)
- **Latência**: buscar imagem no site adiciona 0.5–2s por mensagem — considerar timeout de 3s com fallback automático
- **Cache de imagem**: mesma URL de produto pode ser processada várias vezes — cache por URL com TTL de 1h reduz carga

---

### FEAT-002 · Conexão WhatsApp — estado desconectado e pareamento por número

**Status:** closed  
**Prioridade:** alta  
**Inspiração:** proafiliados.shop — modais `qrcode-modal` e `pairing-modal`

**Descrição:**  
Quando o bot está desconectado, a aba WhatsApp não exibe nenhuma opção de conexão. O correto é mostrar dois métodos de conexão:

1. **QR Code** — escanear com a câmera (comportamento atual ao clicar "Ligar bot", mas sem UI clara)
2. **Código por número** — usuário informa o número, recebe código de 8 dígitos e entra no WhatsApp → Dispositivos vinculados → Vincular pelo número

**Alterações necessárias:**

**Backend — `src/api/routes/session.js`**
```js
// Novo endpoint
app.post('/pairing-code', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { phone } = req.body  // ex: "5511999999999"
  // bot precisa estar rodando e aguardando QR (não conectado ainda)
  const code = await requestPairingCode(userId, phone)
  return { code }  // ex: "ABCD-1234"
})
```

**Manager — `src/manager.js`**
```js
export function requestPairingCode(userId, phone) {
  // envia msg ao worker, worker chama sock.requestPairingCode(phone)
  // retorna Promise<string> com o código
}
```

**bot-worker.js**
```js
// No startBot(), passar registerWithQR: false quando for pareamento por número
// sock.requestPairingCode(phone) retorna o código de 8 dígitos
```

**Dashboard — `dashboard/app/dashboard/page.js`**

Estado desconectado exibe dois botões:
```
┌─────────────────────────────────────────────┐
│  ⚫ Desconectado                             │
├─────────────────────────────────────────────┤
│  [📷 Conectar via QR Code]                  │
│  [📱 Conectar pelo número]                  │
│                                             │
│  [Esquecer número]  ← só se havia sessão    │
└─────────────────────────────────────────────┘
```

Ao clicar "Conectar via QR Code" → inicia bot + abre WebSocket (fluxo atual)  
Ao clicar "Conectar pelo número" → modal pede número → chama `/pairing-code` → exibe código de 8 dígitos

---

### FEAT-003 · Logs de Envio

**Status:** done  
**Prioridade:** média  
**Inspiração:** proafiliados.shop — modal com Total/Sucesso/Erros/Pendente, badge por plataforma, grupo destino, preview da mensagem

**Descrição:**  
Registrar cada envio do bot em banco de dados e exibir no dashboard com filtros por status.

**Schema:**
```prisma
model MessageLog {
  id          String   @id @default(cuid())
  userId      String
  platform    String   // "shopee" | "mercadolivre" etc.
  sourceGroup String   // JID do grupo monitorado
  destGroup   String   // JID do grupo de destino
  originalUrl String
  convertedUrl String
  messageText String
  status      String   @default("success")  // "success" | "error"
  errorMsg    String?
  sentAt      DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

**Dashboard:** modal com abas Todos / Sucesso / Erros, mostrando plataforma, grupo destino, preview da mensagem e timestamp.

---

### FEAT-004 · Conversor AliExpress

**Status:** closed  
**Prioridade:** média  
**Credenciais necessárias:** Track ID + Cookie `xman_t`

**Descrição:**  
AliExpress usa a API de afiliados Portals (`portals.aliexpress.com`). O link de afiliado é gerado passando o `trackingId` e o cookie de sessão `xman_t`.

**Arquivo:** `src/converters/aliexpress.js` (criar)  
**Credenciais:** adicionar `aliexpress` em `REQUIRED` no `credentials.js`

---

### FEAT-005 · Grupos alvo por grupo monitorado

**Status:** closed  
**Prioridade:** alta  
**Inspiração:** proafiliados.shop — "Configurar Alvos" por grupo

**Descrição:**  
Atualmente, quando um link é detectado em qualquer grupo monitor, ele é enviado para **todos** os grupos post. O proafiliados permite configurar, por grupo monitorado, quais grupos de destino receberão as mensagens. Isso é essencial quando o usuário tem grupos de nichos diferentes (ex: grupo monitor de eletrônicos → só dispara para grupo post de eletrônicos).

**Comportamento esperado:**
- Cada grupo com `role: 'monitor'` pode ter uma lista de grupos `role: 'post'` associados
- Se nenhum alvo estiver configurado, mantém comportamento atual (dispara para todos os posts)

**Alterações necessárias:**

**Schema Prisma:**
```prisma
model GroupTarget {
  id          String @id @default(cuid())
  userId      String
  monitorId   String  // Group.id do monitor
  postId      String  // Group.id do post
  user        User    @relation(fields: [userId], references: [id])
  monitor     Group   @relation("MonitorTargets", fields: [monitorId], references: [id], onDelete: Cascade)
  post        Group   @relation("PostTargets", fields: [postId], references: [id], onDelete: Cascade)
  @@unique([monitorId, postId])
}
```

**Backend:** `GET /api/groups/:id/targets`, `PUT /api/groups/:id/targets` (recebe array de postIds)

**bot-worker.js:** `loadConfig()` passa a carregar os alvos de cada grupo monitor. No handler de `messages.upsert`, em vez de usar `cfg.groups.post` global, usa os alvos específicos do monitor que originou a mensagem (fallback para todos se vazio).

**Dashboard:** Botão "Configurar Alvos" em cada card de grupo monitor. Abre modal com lista de grupos post com checkboxes. Badge "Todos" ou "N grupos" mostra o estado atual.

---

### FEAT-006 · Filtros por grupo monitorado

**Status:** open  
**Prioridade:** média  
**Inspiração:** proafiliados.shop — opção "Filtros" por grupo (badge "Nenhum")

**Descrição:**  
Atualmente os filtros (palavras bloqueadas, plataformas habilitadas) são globais em `BotConfig`. O proafiliados permite configurar filtros diferentes por grupo monitorado, permitindo, por exemplo, monitorar Shopee em um grupo e só AliExpress em outro.

**Filtros por grupo:**
- `blockedKeywords` — palavras que, se presentes na mensagem, ignoram o disparo
- `allowedPlatforms` — quais plataformas são convertidas neste grupo (override do global)

**Schema Prisma:**
```prisma
// Adicionar em Group:
blockedKeywords  String?   // CSV, override do global se preenchido
allowedPlatforms String?   // CSV, override do global se preenchido
```

**bot-worker.js:** ao processar mensagem, usa filtros do grupo monitor específico se definidos; senão cai no global `BotConfig`.

**Dashboard:** seção "Filtros" expansível em cada card de grupo monitor.

---

### FEAT-007 · Welcome message por grupo de disparo

**Status:** open  
**Prioridade:** baixa  
**Inspiração:** proafiliados.shop — campo `welcome_message` por grupo

**Descrição:**  
A welcome message atual é global (`BotConfig.welcomeMsg`) e enviada em todos os grupos post quando alguém entra. O correto é configurar mensagens de boas-vindas diferentes por grupo de disparo.

**Schema Prisma:**
```prisma
// Adicionar em Group:
welcomeMsg String?  // override do global para este grupo
```

**bot-worker.js:** no handler `group-participants.update`, usar `group.welcomeMsg` se definido, senão `cfg.botConfig.welcomeMsg`.

---

### FEAT-008 · Toast notifications no dashboard

**Status:** open  
**Prioridade:** baixa  
**Inspiração:** proafiliados.shop — sistema de toast com tipo (success/error/warning/info), título e mensagem, auto-dismiss

**Descrição:**  
Atualmente erros são exibidos como `<p className="text-red-500">` inline, que some ao recarregar a página e não tem auto-dismiss. O padrão do proafiliados usa toasts posicionados no canto superior direito, com ícone por tipo, que desaparecem automaticamente.

**Implementação sugerida:** instalar `react-hot-toast` ou `sonner` (ambos leves, ~2kb). Substituir todos os `setError(err.message)` + `<p className="text-red-500">` por `toast.error(err.message)`. Adicionar `toast.success()` em operações bem-sucedidas (salvar credenciais, remover grupo, etc.).

**Arquivos afetados:** todos os `page.js` do dashboard que têm estado de `error`.

---

### FEAT-009 · Modal de confirmação customizado

**Status:** open  
**Prioridade:** baixa  
**Inspiração:** proafiliados.shop — `showConfirm()` com título, mensagem e botões customizados

**Descrição:**  
Os `confirm()` nativos do browser têm visual inconsistente entre sistemas operacionais, bloqueiam a thread e não permitem customização (cor dos botões, título, ícone). Em mobile, alguns browsers suprimem `confirm()` em contextos de iframe.

**Implementação sugerida:** componente React `<ConfirmModal>` com estado global (Context ou Zustand), substituindo todos os `confirm(...)` do dashboard:
- `handleDelete` em grupos
- `handleCancel` em agendamentos  
- `handleForget` em WhatsApp

Interface:
```js
const { confirm } = useConfirm()
const ok = await confirm({ title: 'Remover grupo?', message: 'Esta ação não pode ser desfeita.', confirmLabel: 'Remover', danger: true })
if (!ok) return
```

---

### FEAT-010 · Instruções inline nas telas de credenciais

**Status:** open  
**Prioridade:** média  
**Inspiração:** proafiliados.shop — box amarelo com passo a passo dentro do modal de cada plataforma

**Descrição:**  
Usuários não sabem onde encontrar AppID, Secret Key, Tag de afiliado etc. O proafiliados exibe um box de instruções numeradas dentro de cada formulário de credencial. Reduz suporte e abandono no onboarding.

**Instruções a adicionar por plataforma:**

| Plataforma | Campos | Onde obter |
|------------|--------|------------|
| Shopee | AppID, Secret Key | affiliate.shopee.com.br → Ferramentas → API de Afiliados → Gerar credenciais |
| Amazon | Tag de afiliado | affiliate-program.amazon.com.br → Gerenciar → Tracking IDs |
| Mercado Livre | Tag de afiliado, Cookie ssid | afiliados.mercadolivre.com.br → cookie de sessão via DevTools |
| Magazine Luiza | Tag | afiliados.magazineluiza.com.br → painel |
| AliExpress | Track ID, Cookie xman_t | portals.aliexpress.com → Ferramentas → Track ID; cookie via extensão EditThisCookie |

**Implementação:** box colapsável (expandido por padrão na primeira visita) em `dashboard/app/dashboard/credenciais/page.js` para cada plataforma.

---

### FEAT-011 · Feed Global

**Status:** open  
**Prioridade:** baixa  
**Inspiração:** proafiliados.shop — "Feed Global" — recebe links de todos os grupos sem precisar configurar monitor individual

**Descrição:**  
O usuário pode ativar um "Feed Global" que monitora automaticamente todos os grupos em que o número está, sem precisar cadastrar cada um como monitor. Links detectados em qualquer grupo são convertidos e disparados para os grupos de destino configurados. Útil para usuários que participam de muitos grupos e querem cobrir todos sem configuração manual.

**Implementação:** campo `feedGlobal: Boolean @default(false)` em `BotConfig`. No bot-worker, no handler `messages.upsert`, se `feedGlobal = true`, não filtra pelo `cfg.groups.monitor` — processa mensagem de qualquer JID.

---

### FEAT-012 · Postar no Status do WhatsApp

**Status:** open  
**Prioridade:** baixa  
**Inspiração:** proafiliados.shop — "Postar no Status"

**Descrição:**  
Além de disparar para grupos, o bot pode postar as mensagens convertidas no Status do WhatsApp do número conectado. O Baileys suporta envio para `status@broadcast`.

**Implementação:**
```js
// Baileys — enviar para Status
await sock.sendMessage('status@broadcast', { text: finalText })
// ou com imagem
await sock.sendMessage('status@broadcast', { image: { url: imgUrl }, caption: finalText })
```

Campo `postToStatus: Boolean @default(false)` em `BotConfig`. Toggle na aba Configurações do dashboard.

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

---

## Módulo 9 — Auditoria UI/UX Dashboard (maio/2026)

### UX-013 · Login sem labels acessíveis nos campos de email/senha
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/login/page.js`

**Descrição:**
A tela de login usa apenas `placeholder` para identificar os campos. Após digitação, a referência visual some e leitores de tela têm contexto limitado.

**Reprodução:**
1. Acessar `/login`.
2. Navegar apenas por teclado/leitor de tela.
3. Observar ausência de `<label>` semântica para os inputs.

**Impacto:**
Piora de acessibilidade (WCAG), maior chance de erro de preenchimento e menor clareza para usuários com necessidades assistivas.

**Correção sugerida:**
Adicionar `label` explícita vinculada por `htmlFor/id` nos campos de email e senha; manter placeholder apenas como exemplo.

---

### UX-014 · Feedback de erro no login sem padronização visual
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/login/page.js`

**Descrição:**
Erros de autenticação são exibidos como texto solto vermelho, sem estrutura de alerta (ícone, título curto, espaçamento consistente).

**Reprodução:**
1. Tentar login com credenciais inválidas.
2. Verificar feedback apresentado abaixo dos campos.

**Impacto:**
Mensagem pode passar despercebida e dificulta compreensão rápida do que fazer em seguida.

**Correção sugerida:**
Criar componente padrão de alerta (`error/success/info`) para uso em todo dashboard.

---

### UX-015 · Ausência de estado de sucesso antes do redirecionamento no login/cadastro
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/login/page.js`

**Descrição:**
Após autenticar, o usuário é redirecionado sem confirmação visual explícita de sucesso.

**Impacto:**
Percepção de travamento em conexões lentas entre a conclusão do submit e a navegação.

**Correção sugerida:**
Exibir estado curto de sucesso (“Login realizado, redirecionando...”) com spinner leve antes de `router.push('/dashboard')`.

---

### UX-016 · Menu lateral sem agrupamento por domínio funcional
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/layout.js`

**Descrição:**
Itens de navegação estão em lista única. Para usuários novos, falta separação entre “Operação”, “Configuração” e “Conta”.

**Impacto:**
Aumento de carga cognitiva na descoberta de funcionalidades.

**Correção sugerida:**
Agrupar links com subtítulos e espaçamento visual; revisar nomenclatura de “📱 WhatsApp” para “Painel” ou “Conexão WhatsApp”.

---

### UX-017 · Estado ativo da navegação depende de igualdade exata de rota
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/layout.js`

**Descrição:**
O destaque usa `pathname === item.href`. Rotas filhas podem perder contexto de item ativo.

**Impacto:**
Desorientação em páginas aninhadas e menor previsibilidade da navegação.

**Correção sugerida:**
Adotar comparação por prefixo controlado (`pathname.startsWith`) onde fizer sentido, evitando falso positivo.

---

### UX-018 · Jornada inicial sem ação orientada quando status falha em carregar
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/inicio/page.js`

**Descrição:**
Se `api.dashboardStatus()` falhar, a tela remove loading mas não apresenta erro nem call-to-action de recuperação.

**Reprodução:**
1. Simular falha de rede na chamada de status.
2. Observar que a interface permanece sem feedback de problema.

**Impacto:**
Usuário sem diagnóstico e sem próximo passo (atualizar/recarregar/suporte).

**Correção sugerida:**
Adicionar estado de erro com botão “Tentar novamente” e mensagem orientativa.

---

### UX-019 · Dependência de cor/vermelho para passos pendentes no onboarding
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/inicio/page.js`

**Descrição:**
Passos pendentes usam forte associação visual em vermelho (`border-red`, `text-red`) como principal sinal.

**Impacto:**
Pode transmitir severidade excessiva e gerar leitura ruim para usuários com daltonismo.

**Correção sugerida:**
Combinar ícone, texto e contraste neutro/âmbar para “pendente”, deixando vermelho para erro real.

---

### UX-020 · Tela de Envio não explicita impacto e irreversibilidade da ação “Enviar agora”
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/envio/page.js`

**Descrição:**
O envio imediato dispara para todos os grupos de destino sem confirmação extra contextual.

**Impacto:**
Risco de disparo acidental e retrabalho operacional.

**Correção sugerida:**
Adicionar resumo de impacto (“X grupos receberão”) + confirmação opcional para primeira utilização ou mensagens longas.

---

### UX-021 · Agendamento usa fuso do navegador sem transparência explícita
**Status:** done  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/envio/page.js`

**Descrição:**
`datetime-local` e `toISOString()` podem gerar confusão de timezone sem indicação clara do fuso efetivo no agendamento.

**Impacto:**
Mensagens enviadas fora do horário esperado.

**Correção sugerida:**
Exibir fuso atual ao lado do campo (ex.: UTC-3) e normalizar parsing no backend com confirmação do horário final.

---

### UX-022 · Erros das áreas de envio/agendamento/listagem não têm severidade diferenciada
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/envio/page.js`

**Descrição:**
Cada bloco mostra erro como texto simples, sem distinguir erro de validação, conectividade ou regra de negócio.

**Impacto:**
Dificulta reação adequada do usuário e troubleshooting.

**Correção sugerida:**
Padronizar mensagens por categoria + possíveis ações (repetir, revisar conteúdo, checar conexão).

---

### UX-023 · Lista de agendamentos sem filtros e sem busca
**Status:** done  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/envio/page.js`

**Descrição:**
Com muitos agendamentos, a lista linear dificulta localizar itens por status/data.

**Impacto:**
Baixa eficiência operacional para usuários ativos.

**Correção sugerida:**
Adicionar filtros rápidos (Todos/Pendentes/Enviados/Falhos/Cancelados) e ordenação por data.

---

### UX-024 · Cancelamento de agendamento sem feedback otimista/estado de processamento
**Status:** done  
**Prioridade:** baixa  
**Arquivo:** `dashboard/app/dashboard/envio/page.js`

**Descrição:**
Ao cancelar, não existe estado visual de progresso no item específico; apenas refresh da lista.

**Impacto:**
Sensação de latência e incerteza durante a ação.

**Correção sugerida:**
Desabilitar botão do item em cancelamento, mostrar estado “Cancelando...” e feedback de sucesso.

---

## Módulo 10 — Auditoria UI/UX Dashboard (Grupo 3: Configurações, Planos, Grupos, Credenciais, Logs)

### UX-025 · Configurações sem estado de erro ao falhar carregamento inicial
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/configuracoes/page.js`

**Descrição:**
A carga inicial usa `catch(() => {})`, ocultando falhas de API. O loading encerra sem feedback claro de indisponibilidade.

**Impacto:**
Usuário pode editar dados desatualizados ou achar que não há configurações salvas.

**Correção sugerida:**
Adicionar `loadError` com CTA “Tentar novamente” e bloqueio de submit até recuperar estado válido.

---

### UX-026 · Planos sem comparação orientada por benefício e sem destaque de recomendação
**Status:** open  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/planos/page.js`

**Descrição:**
Os cards Basic/Pro exibem preço e bullets, mas não deixam explícito “plano recomendado” nem economia/perfil ideal.

**Impacto:**
Aumenta indecisão e reduz conversão em upgrade.

**Correção sugerida:**
Adicionar selo “Mais escolhido” no Pro (ou no plano-alvo), tabela comparativa curta e microcopy por perfil de uso.

---

### UX-027 · Fluxo de indicação não trata erro de clipboard
**Status:** open  
**Prioridade:** baixa  
**Arquivo:** `dashboard/app/dashboard/planos/page.js`

**Descrição:**
`navigator.clipboard.writeText` é chamado sem tratamento de falha/permissão.

**Impacto:**
Usuário não sabe por que o botão não funcionou em contextos com bloqueio de clipboard.

**Correção sugerida:**
Tratar exceção com fallback (selecionar input automaticamente) e feedback de erro amigável.

---

### UX-028 · Tela de Grupos mantém formulário manual com alta fricção técnica
**Status:** open  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/grupos/page.js`

**Descrição:**
Formulário manual exige JID, informação pouco acessível para o usuário final e desalinhada ao fluxo natural de importação do WhatsApp.

**Impacto:**
Polui a tela, gera erros e aumenta suporte.

**Correção sugerida:**
Ocultar por padrão em “modo avançado” ou remover, priorizando importação automática.

---

### UX-029 · Credenciais sem estado de carregamento/erro global por plataforma
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/credenciais/page.js`

**Descrição:**
A tela carrega dados sem indicar loading geral e sem feedback quando `api.credentials()` falha.

**Impacto:**
Usuário pode sobrescrever credenciais sem saber se dados atuais foram realmente carregados.

**Correção sugerida:**
Adicionar loading skeleton por card + erro global com “Recarregar”. Bloquear salvamento enquanto mapa inicial não estiver confiável.

---

### UX-030 · Logs em tabela desktop sem versão responsiva para mobile
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/logs/page.js`

**Descrição:**
A tabela de logs possui múltiplas colunas e truncamentos, sem adaptação para telas pequenas.

**Impacto:**
Leitura e diagnóstico ficam comprometidos em dispositivos móveis.

**Correção sugerida:**
Criar layout alternativo em cards no mobile (origem/destino/status/horário), mantendo tabela apenas em breakpoints maiores.

---

### UX-031 · Logs não oferecem busca textual por conteúdo/grupo
**Status:** open  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/logs/page.js`

**Descrição:**
Filtros atuais cobrem apenas status (Todos/Sucesso/Erros), sem busca por texto, grupo de origem/destino ou plataforma.

**Impacto:**
Baixa eficiência para investigar incidentes em alto volume.

**Correção sugerida:**
Adicionar campo de busca com debounce + filtros combináveis (plataforma/grupo/período).

---

## Módulo 11 — Auditoria UI/UX Dashboard (Grupo 4: Conexão WhatsApp, Home e Infra de feedback)

### UX-032 · Conexão WhatsApp sem retry explícito para geração de QR
**Status:** closed  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/page.js`

**Descrição:**
Quando o QR demora/falha, a tela exibe “Gerando QR Code...” sem timeout visível e sem ação direta de retry contextual.

**Impacto:**
Usuário pode abandonar o fluxo por percepção de travamento.

**Correção sugerida:**
Adicionar contador de espera + botão “Gerar novamente QR” após timeout seguro (ex.: 20s).

---

### UX-033 · Código de pareamento sem affordance de cópia rápida
**Status:** closed  
**Prioridade:** baixa  
**Arquivo:** `dashboard/app/dashboard/page.js`

**Descrição:**
O código de pareamento é exibido em destaque, mas sem botão de copiar.

**Impacto:**
Aumenta atrito operacional em dispositivos onde o usuário alterna entre telas/aparelhos.

**Correção sugerida:**
Adicionar CTA “Copiar código” com feedback de sucesso/erro.

---

### UX-034 · Ações destrutivas (esquecer número/desligar) sem reforço de consequência em contexto
**Status:** closed  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/page.js`

**Descrição:**
Há confirmação em “esquecer número”, porém faltam mensagens persistentes de impacto após execução (ex.: sessão removida, precisa reescanear).

**Impacto:**
Usuário pode não entender o estado final e repetir ações desnecessárias.

**Correção sugerida:**
Exibir toast/alerta pós-ação com próximos passos claros.

---

### UX-035 · Home com redirecionamento silencioso sem fallback visual
**Status:** closed  
**Prioridade:** baixa  
**Arquivo:** `dashboard/app/page.js`

**Descrição:**
A Home retorna `null` enquanto decide rota por token, sem indicador de carregamento.

**Impacto:**
Em dispositivos lentos, pode parecer tela branca momentânea.

**Correção sugerida:**
Renderizar estado mínimo (“Redirecionando...”) com acessibilidade (`aria-live="polite"`).

---

### UX-036 · Camada de API força redirect em 401 sem aviso prévio ao usuário
**Status:** closed  
**Prioridade:** alta  
**Arquivo:** `dashboard/lib/api.js`

**Descrição:**
Ao receber 401, remove token e redireciona para login imediatamente, sem explicar motivo (sessão expirada/invalidada).

**Impacto:**
Quebra de contexto e frustração por perda de fluxo.

**Correção sugerida:**
Persistir mensagem de sessão expirada (query param ou storage) e exibir alerta no login após redirect.

---

### UX-037 · WebSocket de QR sem superfície de erro/estado de conexão na UI
**Status:** closed  
**Prioridade:** média  
**Arquivo:** `dashboard/lib/api.js` + `dashboard/app/dashboard/page.js`

**Descrição:**
`openQRSocket` não expõe eventos de erro/close para camada de UI além de mensagens recebidas.

**Impacto:**
Dificulta diagnóstico quando socket cai silenciosamente.

**Correção sugerida:**
Encapsular handlers `onerror/onclose` e refletir estado (“Conexão perdida. Tentando reconectar...”).

---

## Módulo 12 — Auditoria UI/UX (Fluxos secundários e consistência transversal)

### UX-038 · Ausência de padrão único para estados de loading/erro/empty entre telas
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/*/page.js`

**Descrição:**
Cada tela implementa loading/erro/empty de forma diferente (texto simples, sem componentes compartilhados), gerando inconsistência de percepção.

**Impacto:**
Experiência fragmentada e maior esforço de manutenção de UI.

**Correção sugerida:**
Criar design tokens/componentes reutilizáveis (`LoadingState`, `ErrorState`, `EmptyState`) e aplicar em todo dashboard.

---

### UX-039 · Dependência de `window.confirm` em ações críticas sem padrão visual do produto
**Status:** open  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/page.js`, `dashboard/app/dashboard/grupos/page.js`, `dashboard/app/dashboard/envio/page.js`, `dashboard/app/dashboard/logs/page.js`

**Descrição:**
Confirmações usam modal nativo do navegador, que quebra consistência visual e não oferece contexto rico (impacto, quantidade afetada, opção secundária).

**Impacto:**
Perda de confiança e experiência inconsistente entre browsers/dispositivos.

**Correção sugerida:**
Implementar modal de confirmação próprio com variantes (danger/warning), texto contextual e foco acessível.

---

### UX-040 · Inconsistência de linguagem e tom entre feedbacks de sucesso/erro
**Status:** open  
**Prioridade:** média  
**Arquivo:** `dashboard/app/dashboard/configuracoes/page.js`, `dashboard/app/dashboard/envio/page.js`, `dashboard/app/dashboard/planos/page.js`, `dashboard/app/login/page.js`

**Descrição:**
Mensagens variam entre estilos (“✓”, frases curtas, erros crus de API), sem guia editorial único.

**Impacto:**
Menor clareza comunicacional e percepção menos profissional.

**Correção sugerida:**
Definir guideline de microcopy (voz, tamanho, CTA sugerido) e normalizar mensagens por tipo de evento.

---

### UX-041 · Falta de indicadores de acessibilidade dinâmica (`aria-live`) para mensagens de status
**Status:** open  
**Prioridade:** média  
**Arquivo:** `dashboard/app/login/page.js`, `dashboard/app/dashboard/envio/page.js`, `dashboard/app/dashboard/configuracoes/page.js`

**Descrição:**
Mensagens de erro/sucesso surgem visualmente, mas sem regiões `aria-live` para leitores de tela.

**Impacto:**
Usuários com tecnologia assistiva podem não perceber mudanças de estado em tempo real.

**Correção sugerida:**
Adicionar regiões `aria-live="polite/assertive"` para alertas críticos e confirmações de ação.

---

### UX-042 · Suporte mobile parcial na navegação lateral do dashboard
**Status:** open  
**Prioridade:** alta  
**Arquivo:** `dashboard/app/dashboard/layout.js`

**Descrição:**
Layout atual fixa sidebar com largura estática (`w-56`) sem comportamento explícito de colapso/menu em telas menores.

**Impacto:**
Risco de overflow, baixa usabilidade em smartphones e interação comprometida.

**Correção sugerida:**
Criar navegação responsiva (drawer/hamburger), preservando contexto de tela ativa e ação de logout.
