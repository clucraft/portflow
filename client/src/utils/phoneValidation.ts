// Common country codes for E.164 format
export const COUNTRY_CODES = [
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+61', name: 'Australia' },
  { code: '+81', name: 'Japan' },
  { code: '+86', name: 'China' },
  { code: '+91', name: 'India' },
  { code: '+52', name: 'Mexico' },
  { code: '+55', name: 'Brazil' },
] as const;

export type CountryCode = typeof COUNTRY_CODES[number]['code'];

/**
 * Validates a phone number against E.164 format and the expected country code
 * @param phoneNumber The phone number to validate
 * @param expectedCountryCode The country code the number should start with (e.g., '+1')
 * @returns An object with isValid boolean and error message if invalid
 */
export function validatePhoneNumber(
  phoneNumber: string,
  expectedCountryCode: string
): { isValid: boolean; error?: string } {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return { isValid: true }; // Empty is allowed (phone number is optional)
  }

  const cleaned = phoneNumber.trim();

  // Must start with +
  if (!cleaned.startsWith('+')) {
    return {
      isValid: false,
      error: `Phone number must start with ${expectedCountryCode}`,
    };
  }

  // Must only contain digits after the +
  const digitsOnly = cleaned.slice(1);
  if (!/^\d+$/.test(digitsOnly)) {
    return {
      isValid: false,
      error: 'Phone number must contain only digits after the + sign',
    };
  }

  // Must start with the expected country code
  if (!cleaned.startsWith(expectedCountryCode)) {
    return {
      isValid: false,
      error: `Phone number must start with ${expectedCountryCode}`,
    };
  }

  return { isValid: true };
}
