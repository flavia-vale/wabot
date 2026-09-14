function enabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true'
}

function allowlisted(userId, value) {
  const ids = String(value ?? '').split(',').map(item => item.trim()).filter(Boolean)
  return ids.length === 0 || ids.includes(String(userId))
}

export function reviewFeatureEnabled(env = process.env) {
  return enabled(env.OFFER_AUTOMATION_REVIEW_ENABLED)
}

export function reviewDeliveryEnabled(env = process.env) {
  return reviewFeatureEnabled(env) && enabled(env.OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED)
}

export function canUseReview(userId, env = process.env) {
  return reviewFeatureEnabled(env) && allowlisted(userId, env.OFFER_AUTOMATION_REVIEW_USER_IDS)
}

export function canDeliverReview(userId, env = process.env) {
  return reviewDeliveryEnabled(env) && allowlisted(userId, env.OFFER_AUTOMATION_REVIEW_USER_IDS)
}
