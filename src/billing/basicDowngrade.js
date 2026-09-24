// Divisão Basic/PRO (2026-09-23): o que muda na CONFIGURAÇÃO de quem não tem o
// PRO e ainda guarda escolhas que o Basic deixou de ter. PURO (sem banco) —
// consumido por `scripts/basic-sem-recursos-pro.mjs`.
//
// O robô já não usa essas escolhas (chokepoint em groupEntitlements.js), e a
// tela já mostra sem elas (presentGroupsForPlan). Este passo só faz o BANCO
// dizer a mesma coisa, para ninguém ler a escolha antiga e concluir que vale.
//
// Regra da dona do produto: card com marca → card; foto com marca → foto. O
// texto da marca fica guardado (voltar ao PRO não pede para configurar de novo).
import { getPlanEntitlements } from './plans.js'
import { destinationImageModeWithoutWatermark, destinationImageUsesWatermark } from '../core/imageModePolicy.js'

export function planBasicDowngrade({ planSubject, groups = [], botConfig = null, now = new Date() } = {}) {
  const ent = getPlanEntitlements(planSubject ?? { plan: 'basic' }, { now })
  const groupChanges = []
  for (const group of groups) {
    if (group?.role !== 'post') continue
    const data = {}
    if (!ent.canUseWatermark && destinationImageUsesWatermark(group.imageMode)) {
      data.imageMode = destinationImageModeWithoutWatermark(group.imageMode)
    }
    if (!ent.canUseChannelButton && group.channelButtonJid) {
      data.channelButtonJid = null
      data.channelButtonName = null
    }
    if (Object.keys(data).length) groupChanges.push({ id: group.id, name: group.name, from: { imageMode: group.imageMode, channelButtonJid: group.channelButtonJid ?? null }, data })
  }
  const configChange = !ent.canUseCopyVariation && botConfig?.copyVariationEnabled === true
    ? { copyVariationEnabled: false }
    : null
  return { groupChanges, configChange }
}
