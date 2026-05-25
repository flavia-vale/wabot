# Evidências de Gate — P1 (staging-first)

> Objetivo: registrar evidências objetivas para o item DoD de staging antes de promover para produção.

## Checklist obrigatório (executar em `~/wabot-staging`)

```bash
cd ~/wabot-staging && git pull origin develop && npm install
cd ~/wabot-staging/dashboard && npm install
cd ~/wabot-staging && npx prisma migrate deploy
cd ~/wabot-staging && pm2 restart api-staging visual-staging
curl -i http://178.105.54.0:3006/login
curl -i http://127.0.0.1:3004/health
curl -i -X POST http://178.105.54.0:3006/api/auth/login -H 'content-type: application/json' --data '{"email":"smoke@example.invalid","password":"invalid"}'
```

## Evidência a preencher

- Data/hora (UTC): ____
- Commit/branch: ____
- Resultado `GET /login`: ____
- Resultado `GET /health`: ____
- Resultado `POST /api/auth/login` (JSON, não 404 Next): ____
- Responsável validação: ____
- Decisão: GO / NO-GO
