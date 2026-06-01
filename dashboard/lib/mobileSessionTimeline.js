const STEP_LABELS = ['Serviço', 'QR Code', 'Lido', 'Validação', 'Online']

function deriveProgress({ running, qr, isQrScanned, isConnected }) {
  if (isConnected) return 5
  if (isQrScanned) return 3
  if (qr) return 2
  if (running) return 1
  return 0
}

function buildStep(index, progress) {
  const stepNumber = index + 1
  const status = progress >= stepNumber ? 'done' : progress === stepNumber - 1 ? 'active' : 'pending'
  return { key: STEP_LABELS[index].toLowerCase().replace(' ', '-'), label: STEP_LABELS[index], status }
}

export function deriveTimelineSteps({ running = false, qr = null, isQrScanned = false, isConnected = false } = {}) {
  const progress = deriveProgress({ running, qr, isQrScanned, isConnected })
  return STEP_LABELS.map((_, index) => buildStep(index, progress))
}
