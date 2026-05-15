import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateWhatsAppGroupTimeSavings,
  clampCalculatorInput,
  formatCurrency,
  formatHours,
  sanitizeCalculatorInputs,
} from '../dashboard/lib/free-tools/time-calculator.js'

test('time calculator estimates monthly manual and saved hours for default-like operation', () => {
  const result = calculateWhatsAppGroupTimeSavings({
    monitorGroups: 5,
    destinationGroups: 3,
    offersPerDay: 12,
    minutesPerOffer: 4,
    daysPerWeek: 6,
    hourlyValue: 25,
  })

  assert.equal(result.monthlyOfferReviews, 312)
  assert.equal(result.dailyPosts, 36)
  assert.ok(result.manualHoursMonth > 30)
  assert.ok(result.savedHoursMonth > 20)
  assert.ok(result.opportunityCost > 500)
  assert.equal(result.riskLevel.id, 'low')
})

test('time calculator flags high-volume operations as high risk', () => {
  const result = calculateWhatsAppGroupTimeSavings({
    monitorGroups: 40,
    destinationGroups: 15,
    offersPerDay: 25,
    minutesPerOffer: 6,
    daysPerWeek: 7,
    hourlyValue: 40,
  })

  assert.equal(result.riskLevel.id, 'high')
  assert.match(result.cadenceRecommendation, /20–35 min/)
  assert.ok(result.manualHoursMonth >= 120)
})

test('calculator inputs are clamped to safe public-tool ranges', () => {
  assert.equal(clampCalculatorInput('monitorGroups', -10), 1)
  assert.equal(clampCalculatorInput('destinationGroups', 10000), 500)
  assert.equal(clampCalculatorInput('daysPerWeek', 99), 7)
  assert.equal(clampCalculatorInput('hourlyValue', 'not-a-number'), 25)

  const safe = sanitizeCalculatorInputs({ offersPerDay: 0, minutesPerOffer: 999 })
  assert.equal(safe.offersPerDay, 1)
  assert.equal(safe.minutesPerOffer, 60)
})

test('calculator formatters use pt-BR friendly output', () => {
  assert.equal(formatHours(18.25), '18,3')
  assert.equal(formatCurrency(1234), 'R$ 1.234')
})
