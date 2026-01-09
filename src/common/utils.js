/**
 * PrivacyGuard Utility Functions
 * Common helper functions used across modules
 */

/**
 * Safely parse a URL, returning null on error
 * @param {string} urlString - The URL string to parse
 * @returns {URL|null} - Parsed URL object or null
 */
function pgSafeParseUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return null;
  
  try {
    return new URL(urlString);
  } catch (e) {
    return null;
  }
}

/**
 * Check if a hostname is a local/private address
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if local
 */
function pgIsLocalHost(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  
  const h = hostname.toLowerCase().trim();
  
  return (
    h === "localhost" ||
    h === "localhost.localdomain" ||
    h === "local" ||
    h === "broadcasthost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.startsWith("127.") ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    h.startsWith("172.16.") ||
    h.startsWith("172.17.") ||
    h.startsWith("172.18.") ||
    h.startsWith("172.19.") ||
    h.startsWith("172.20.") ||
    h.startsWith("172.21.") ||
    h.startsWith("172.22.") ||
    h.startsWith("172.23.") ||
    h.startsWith("172.24.") ||
    h.startsWith("172.25.") ||
    h.startsWith("172.26.") ||
    h.startsWith("172.27.") ||
    h.startsWith("172.28.") ||
    h.startsWith("172.29.") ||
    h.startsWith("172.30.") ||
    h.startsWith("172.31.")
  );
}

/**
 * Normalize a domain name
 * @param {string} domain - The domain to normalize
 * @returns {string|null} - Normalized domain or null
 */
function pgNormalizeDomain(domain) {
  if (!domain || typeof domain !== "string") return null;
  
  let d = domain.trim().toLowerCase();
  if (d.endsWith(".")) d = d.slice(0, -1);
  
  if (!d || d.length === 0) return null;
  
  return d;
}

/**
 * Validate a domain name format
 * @param {string} domain - The domain to validate
 * @returns {boolean} - True if valid
 */
function pgIsValidDomain(domain) {
  if (!domain || typeof domain !== "string") return false;
  
  const d = domain.trim().toLowerCase();
  
  if (d.includes(" ") || !d.includes(".")) return false;
  if (/^[0-9.]+$/.test(d)) return false; // IP addresses
  if (d.endsWith(".")) return false;
  if (!/^[a-z0-9.-]+$/.test(d)) return false;
  if (d.startsWith("-") || d.endsWith("-")) return false;
  if (d.includes("..")) return false;
  
  return true;
}

/**
 * Clamp a number between min and max
 * @param {number} n - The number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
function pgClamp(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  const clamped = Math.max(min, Math.min(max, Math.floor(num)));
  return clamped;
}

/**
 * Safe string conversion with fallback
 * @param {*} value - Value to convert
 * @param {string} fallback - Fallback value
 * @returns {string} - String representation
 */
function pgSafeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function pgDebounce(func, wait) {
  let timeout = null;
  
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function pgThrottle(func, limit) {
  let inThrottle = false;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
