/**
 * Masks and checks for national ID, phone, RNC, and street number.
 * Dominican cédula is 11 digits: 000-0000000-0.
 */

type KeyGuardEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  preventDefault: () => void
  currentTarget: HTMLInputElement
}

const NAVIGATION_KEYS = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']

export function formatNationalId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`
}

export function isValidNationalId(value: string): boolean {
  return /^\d{3}-\d{7}-\d$/.test(value.trim())
}

export function formatRnc(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9)
}

export function isValidRnc(value: string): boolean {
  return /^\d{9}$/.test(value.trim())
}

export function formatStreetNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

export function isValidStreetNumber(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length === 0 || /^\d{1,6}$/.test(trimmed)
}

function formatNanp(digits: string): string {
  const d = digits.slice(0, 10)
  if (!d) return ''
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** Local numbers become (809) 555-0101. A leading + keeps an international number. */
export function formatPhoneInput(raw: string): string {
  const international = raw.includes('+')
  const digits = raw.replace(/\D/g, '').slice(0, international ? 15 : 10)
  if (!international) return formatNanp(digits)
  if (!digits) return '+'
  if (digits.startsWith('1')) {
    const local = formatNanp(digits.slice(1, 11))
    return local ? `+1 ${local}` : '+1'
  }
  const parts: string[] = []
  for (let index = 0; index < digits.length; index += 3) {
    parts.push(digits.slice(index, index + 3))
  }
  return `+${parts.join('-')}`
}

function isNanp(digits: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return false
  if (trimmed.includes('+')) return /^[1-9]\d{7,14}$/.test(digits)
  if (digits.length === 11 && digits.startsWith('1')) return isNanp(digits.slice(1))
  if (digits.length === 10) return isNanp(digits)
  return false
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function isValidPersonName(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= 2 && /\p{L}/u.test(trimmed)
}

/** Blocks letters and extra digits. Dashes and parentheses are inserted by the mask. */
export function allowFormattedKey(event: KeyGuardEvent, options: { allowPlus?: boolean; maxDigits: number }) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (NAVIGATION_KEYS.includes(event.key)) return
  const input = event.currentTarget
  if (
    options.allowPlus
    && event.key === '+'
    && !input.value.includes('+')
    && (input.selectionStart ?? 0) === 0
  ) {
    return
  }
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
    return
  }
  const selected = input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0).replace(/\D/g, '').length
  const digits = input.value.replace(/\D/g, '').length
  if (digits - selected >= options.maxDigits) event.preventDefault()
}
