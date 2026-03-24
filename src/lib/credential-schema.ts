/**
 * Validates that a raw string is a valid Claude credentials.json file.
 * We check it's valid JSON and an object, but don't enforce specific fields
 * since the Claude CLI credential format may evolve.
 */
export function validateCredentialsJson(raw: string): { valid: boolean; error?: string } {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: 'Credentials must be a JSON object' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid JSON' }
  }
}
