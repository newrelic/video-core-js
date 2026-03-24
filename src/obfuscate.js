import Log from "./log";

/**
 * Applies obfuscation rules to a JSON string before sending to the collector.
 * Each rule replaces matches of `regex` with `replacement` in the string.
 *
 * @param {string} jsonString - Serialized JSON payload
 * @param {Array<{regex: string|RegExp, replacement: string}>} rules - Obfuscation rules
 * @returns {string} Obfuscated string
 */
export function applyObfuscationRules(jsonString, rules) {
  if (!rules || rules.length === 0) return jsonString;

  return rules.reduce((str, rule) => {
    let pattern;
    try {
      if (rule.regex instanceof RegExp) {
        // Ensure global flag so all occurrences are replaced
        const flags = rule.regex.flags.includes("g")
          ? rule.regex.flags
          : rule.regex.flags + "g";
        pattern = new RegExp(rule.regex.source, flags);
      } else {
        pattern = new RegExp(rule.regex, "g");
      }
    } catch (e) {
      Log.warn("applyObfuscationRules: invalid regex, skipping rule:", rule.regex, e.message);
      return str;
    }
    let s = str.replace(pattern, rule.replacement);
    return s;
  }, jsonString);
}
