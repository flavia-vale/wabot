# Medição da Fase 0 — leitor do Telegram (feature 021)

Script **isolado** para medir quanto o leitor de ofertas pela conta pessoal do
Telegram gasta de memória, antes de qualquer processo de verdade existir.
Spec/plano: `specs/021-telegram-origem-conta-pessoal/`.

## Garantias (não regredir)

- Roda **fora do repositório**, numa pasta própria do VPS (`~/telegram-spike/`),
  com `npm install` só lá. O `package.json` do produto **não** ganha a
  dependência (guarda: `test/spike-fora-do-package.test.js`) — por isso o
  arquivo daqui se chama `package.spike.json`.
- **Só leitura.** Nunca envia, nunca marca como lida, nunca entra nem sai de
  canal (a conta de teste entra nos canais pelo aplicativo, à mão).
- Lê **só** os chats listados em `canais.txt`; qualquer outro (inclusive
  conversa privada) é descartado antes de qualquer registro.
- Nenhum texto de mensagem, telefone, chave ou sessão vai para log ou tela.
- Não reinicia nada do produto. O único processo PM2 dela é `telegram-spike`,
  e o fim é `pm2 delete telegram-spike`.

## Arquivos

| Aqui no repo | Vira em `~/telegram-spike/` |
|---|---|
| `telegram-leitor-spike.mjs` | `telegram-leitor-spike.mjs` |
| `resumir-medicao.mjs` | `resumir-medicao.mjs` |
| `package.spike.json` | `package.json` |
| — | `.env` (TELEGRAM_API_ID / TELEGRAM_API_HASH, `chmod 600`) |
| — | `sessions/<apelido>.session` (`chmod 600`) |
| — | `canais.txt` (um id por linha) |
| — | saídas: `memoria.csv` (`iso,rotulo,contas,canais,rss_mb,heap_mb,external_mb,swap_mb`), `latencia.csv`, `eventos.log`, `RESULTADO.md` |

⚠️ **Nunca** commitar `sessions/`, `.env` ou as saídas.

Versões fixadas: `telegram` (GramJS) **2.26.22** — a mesma que o PR-1 vai
fixar no produto — e `qrcode-terminal` **0.12.0**.

Passo a passo para quem roda: `PASSO-A-PASSO-DONA.md`. Formato do resultado:
`RESULTADO-MODELO.md`.
