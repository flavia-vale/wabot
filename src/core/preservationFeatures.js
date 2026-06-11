export const PRESERVATION_FEATURE = Object.freeze({
  CHANNEL_THROTTLE: 'channelThrottleEnabled',
  QUIET_HOURS: 'quietHoursEnabled',
  FOLLOW_GUARD: 'followGuardEnabled',
  COPY_VARIATION: 'copyVariationEnabled',
  IMAGE_MUTATION: 'imageMutationActive',
  PROBE: 'probeEnabled',
})

export function isPreservationFeatureEnabled(preservationActive, botConfig, feature) {
  return preservationActive === true && botConfig?.[feature] === true
}

export function shouldRunChannelScheduler(preservationActive, botConfig) {
  return isPreservationFeatureEnabled(preservationActive, botConfig, PRESERVATION_FEATURE.CHANNEL_THROTTLE)
    || isPreservationFeatureEnabled(preservationActive, botConfig, PRESERVATION_FEATURE.QUIET_HOURS)
}
