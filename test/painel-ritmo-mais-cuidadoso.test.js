// contracts/ui-anti-banimento.md § Ritmo por grupo (User Story 2):
// - `ritmoMaisCuidadoso` → mostra a etiqueta "🐢 Ritmo mais cuidadoso"
// - `recomecouDoPadrao` → NÃO mostra etiqueta nem aviso técnico
// - as duas nunca vêm juntas (describeDestinationFloor já garante isso;
//   aqui travamos que a TELA respeita o contrato).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ritmoPartSource = readFileSync(new URL('../dashboard/app/painel/anti-banimento/RitmoPart.js', import.meta.url), 'utf8')

test('a lista de destinos renderiza a etiqueta "Ritmo mais cuidadoso" quando ritmoMaisCuidadoso é true', () => {
  assert.match(ritmoPartSource, /ritmoMaisCuidadoso/)
  assert.match(ritmoPartSource, /🐢 Ritmo mais cuidadoso/)
})

test('a lista de presets também mostra a etiqueta quando o preset tem ritmoMaisCuidadoso', () => {
  const presetSection = ritmoPartSource.slice(
    ritmoPartSource.indexOf('Ritmos prontos'),
    ritmoPartSource.indexOf('Grupos e canais'),
  )
  assert.match(presetSection, /p\.ritmoMaisCuidadoso/)
  assert.match(presetSection, /🐢 Ritmo mais cuidadoso/)
})

test('recomecouDoPadrao NÃO tem etiqueta nem texto técnico associado na tela', () => {
  // O campo chega da API (contracts/api-preservation.md) mas o contrato de UI
  // diz explicitamente: destino que recomeçou do padrão não ganha etiqueta
  // nem aviso jargão — só mostra os valores efetivos nos campos editáveis
  // (aqui: nenhum texto extra é renderizado para esse estado).
  assert.doesNotMatch(ritmoPartSource, /recomecouDoPadrao[\s\S]{0,80}<span/)
})

test('"Voltar ao ritmo padrão" existe e grava null nos campos de override via PUT /destinations/:id existente', () => {
  assert.match(ritmoPartSource, /Voltar ao ritmo padr[ãa]o/)
  assert.match(ritmoPartSource, /updatePreservationDestination/)
  // Os campos zerados são os de override DIRETO no destino — nunca o preset
  // atribuído (preservationPresetId não pode estar nessa lista).
  const resetBlock = ritmoPartSource.slice(
    ritmoPartSource.indexOf('DESTINATION_OVERRIDE_KEYS'),
    ritmoPartSource.indexOf('DESTINATION_OVERRIDE_KEYS') + 400,
  )
  assert.doesNotMatch(resetBlock, /preservationPresetId/)
})
