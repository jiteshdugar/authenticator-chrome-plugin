/**
 * OTP Logic wrapper for Authenticator Extension
 * Uses OTPAuth library to generate tokens
 */

const OTPLogic = {
  /**
   * Generate a TOTP token for an account
   * @param {Object} account { secret, name, issuer, period, digits }
   * @returns {Object} { token, remainingTime, period }
   */
  generateToken(account) {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: account.issuer || 'App',
        label: account.name || 'User',
        algorithm: 'SHA1',
        digits: account.digits || 6,
        period: account.period || 30,
        secret: account.secret
      });

      const token = totp.generate();
      
      // Calculate remaining time
      const period = account.period || 30;
      const epoch = Math.floor(Date.now() / 1000);
      const remainingTime = period - (epoch % period);
      
      return {
        token,
        remainingTime,
        period
      };
    } catch (e) {
      console.error('Failed to generate token', e);
      return { token: 'ERR', remainingTime: 0, period: 30 };
    }
  },

  /**
   * Parse an otpauth:// migration URI or standard URI
   * @param {string} uri 
   * @returns {Object|null}
   */
  parseURI(uri) {
    try {
      const parsed = OTPAuth.URI.parse(uri);
      return {
        name: parsed.label,
        issuer: parsed.issuer,
        secret: parsed.secret.base32,
        type: parsed.type === 'totp' ? 'TOTP' : 'HOTP',
        period: parsed.period || 30,
        digits: parsed.digits || 6
      };
    } catch (e) {
      console.error('Failed to parse OTP URI', e);
      return null;
    }
  }
};
