/**
 * Parse a single CSV line respecting quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((header, i) => {
      obj[header] = values[i] || ''
    })
    return obj
  })
}

/**
 * Get headers from CSV string
 */
export function getCSVHeaders(csv: string): string[] {
  const lines = csv.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []
  return parseCSVLine(lines[0])
}

/**
 * Common field name variations for auto-detection
 */
const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ['first_name', 'firstname', 'first name', 'fname', 'first'],
  lastName: ['last_name', 'lastname', 'last name', 'lname', 'last', 'surname'],
  email: ['email', 'e-mail', 'email_address', 'emailaddress', 'mail'],
  phone: ['phone', 'phone_number', 'phonenumber', 'telephone', 'tel', 'mobile', 'cell']
}

/**
 * Auto-detect field mappings from CSV headers
 */
export function autoDetectMappings(headers: string[]): Record<string, string | null> {
  const mappings: Record<string, string | null> = {
    firstName: null,
    lastName: null,
    email: null,
    phone: null
  }

  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const index = normalizedHeaders.indexOf(alias)
      if (index !== -1) {
        mappings[field] = headers[index]
        break
      }
    }
  }

  return mappings
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
