# Homepage vendor fallback

Este diretório é o fallback local para bibliotecas críticas da homepage (`React`, `ReactDOM` e `Babel Standalone`).

## Arquivos esperados
- `react.development.js`
- `react-dom.development.js`
- `babel.min.js`

## Procedimento de atualização
1. Baixe versões aprovadas em ambiente com acesso externo.
2. Publique os arquivos neste diretório com os nomes acima.
3. Valide carregamento com bloqueio de saída HTTP/HTTPS na VPS.
