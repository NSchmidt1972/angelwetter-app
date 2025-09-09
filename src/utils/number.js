// src/utils/number.js
export function parseFloatLocale(str) {
if (str == null || str === "") return NaN;
return parseFloat(String(str).replace(",", "."));
}