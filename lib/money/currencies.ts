const FALLBACK_CURRENCIES = [
  "USD", "EUR", "GBP", "GHS", "NGN", "KES", "ZAR", "CAD", "AUD", "JPY", "CNY", "INR", "BRL", "MXN", "CHF", "SEK", "NOK", "DKK",
  "PLN", "TRY", "AED", "SAR", "QAR", "EGP", "MAD", "RUB", "HKD", "SGD", "KRW", "NZD",
];

export function supportedCurrencies() {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("currency").map((c) => c.toUpperCase()).sort();
    }
  } catch {
    // Fallback below.
  }
  return FALLBACK_CURRENCIES;
}
