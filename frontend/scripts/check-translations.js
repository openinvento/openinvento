import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const localesDirectory = fileURLToPath(new URL("../src/locales/", import.meta.url));
const files = (await readdir(localesDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`No translation JSON files found in ${localesDirectory}`);
  process.exit(1);
}

const translations = new Map();
let hasErrors = false;

for (const file of files) {
  const filePath = path.join(localesDirectory, file);

  try {
    translations.set(path.basename(file, ".json"), JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    console.error(`${file}: invalid JSON (${error.message})`);
    hasErrors = true;
  }
}

if (hasErrors) process.exit(1);

const reference = translations.get("en");
if (!reference || !isObject(reference)) {
  console.error("en.json must exist and contain a JSON object to use as the reference locale.");
  process.exit(1);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function flatten(value, prefix = "", result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isObject(child)) {
      flatten(child, fullKey, result);
    } else if (typeof child === "string") {
      result.set(fullKey, child);
    } else {
      console.error(`${fullKey}: translation values must be strings or nested objects.`);
      hasErrors = true;
    }
  }
  return result;
}

function interpolationVariables(value) {
  return [...value.matchAll(/{{\s*-?\s*([^{}]+?)\s*}}/g)]
    .map((match) => match[1].trim())
    .sort();
}

const referenceKeys = flatten(reference);

for (const [locale, translation] of translations) {
  if (locale === "en") continue;
  const localeKeys = flatten(translation);
  const extra = [...localeKeys.keys()].filter((key) => !referenceKeys.has(key));

  for (const key of extra) {
    console.error(`${locale}.json: key "${key}" does not exist in en.json`);
    hasErrors = true;
  }
  for (const [key, value] of localeKeys) {
    if (!referenceKeys.has(key)) continue;
    const expected = interpolationVariables(referenceKeys.get(key));
    const actual = interpolationVariables(value);
    if (expected.join("\0") !== actual.join("\0")) {
      console.error(`${locale}.json: interpolation variables for "${key}" differ from en.json (expected: ${expected.join(", ") || "none"}; found: ${actual.join(", ") || "none"})`);
      hasErrors = true;
    }
  }
}

if (hasErrors) process.exit(1);
console.log(`Validated ${files.length} locale JSON files and their keys/interpolation variables against en.json.`);
