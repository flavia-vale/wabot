// Lê o modo de reinício do needrestart a partir do texto dos arquivos de
// configuração (o principal + conf.d em ordem; o ÚLTIMO a definir vence,
// como o próprio needrestart faz). Puro: recebe os textos, não lê disco.
//
// Retorno: 'l' | 'i' | 'a' | outro valor literal; 'i' quando instalado sem
// definição (padrão do needrestart); null quando não há arquivo nenhum
// (não instalado).
export function parseNeedrestartMode(texts = []) {
  if (!texts.length) return null
  let mode = 'i'
  const re = /^\s*\$nrconf\{restart\}\s*=\s*['"]([a-z])['"]\s*;/
  for (const text of texts) {
    for (const line of String(text ?? '').split('\n')) {
      const m = line.match(re)
      if (m) mode = m[1]
    }
  }
  return mode
}
