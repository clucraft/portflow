// Common country codes for E.164 validation
export const COUNTRY_CODES = [
  { code: '+1', name: 'United States / Canada', minLength: 11, maxLength: 11 },
  { code: '+44', name: 'United Kingdom', minLength: 12, maxLength: 13 },
  { code: '+49', name: 'Germany', minLength: 12, maxLength: 14 },
  { code: '+33', name: 'France', minLength: 12, maxLength: 12 },
  { code: '+61', name: 'Australia', minLength: 11, maxLength: 12 },
  { code: '+81', name: 'Japan', minLength: 12, maxLength: 13 },
  { code: '+86', name: 'China', minLength: 13, maxLength: 14 },
  { code: '+91', name: 'India', minLength: 13, maxLength: 13 },
  { code: '+52', name: 'Mexico', minLength: 13, maxLength: 13 },
  { code: '+55', name: 'Brazil', minLength: 13, maxLength: 14 },
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
      error: `Phone number must start with + (e.g., ${expectedCountryCode}1234567890)`,
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
      error: `Phone number must start with ${expectedCountryCode} for this migration`,
    };
  }

  // Check length based on country code
  const countryConfig = COUNTRY_CODES.find(c => c.code === expectedCountryCode);
  if (countryConfig) {
    const totalLength = cleaned.length;
    if (totalLength < countryConfig.minLength || totalLength > countryConfig.maxLength) {
      return {
        isValid: false,
        error: `Phone number should be ${countryConfig.minLength}-${countryConfig.maxLength} characters for ${countryConfig.name} (currently ${totalLength})`,
      };
    }
  } else {
    // For unknown country codes, just check reasonable length
    if (cleaned.length < 8 || cleaned.length > 16) {
      return {
        isValid: false,
        error: 'Phone number should be between 8 and 16 characters',
      };
    }
  }

  return { isValid: true };
}
