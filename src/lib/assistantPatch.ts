/**
 * Tillämpar en AI-föreslagen ändring på ett projekt.
 *
 * Säkerhetsgränsen är enkel: en nyckel skrivs bara om den redan finns på
 * samma plats i projektet, med samma typ av värde. Modellen kan alltså
 * ändra befintliga tal, texter och true/false-fält, men aldrig hitta på nya
 * fält eller ändra formen på datan. Allt annat ignoreras tyst i stället för
 * att fela — ett ofullständigt eller delvis fel förslag ska fortfarande
 * kunna tillämpa de delar som går att tolka.
 */
/**
 * De enda fälten där ett `null`-värde kan betyda antingen text eller tal.
 * Utan den här listan skulle en patch kunna skriva vilken sträng som helst
 * i ett belopp som råkar stå tomt, eftersom `null` i sig inte avslöjar den
 * avsedda typen.
 */
const NULLABLE_STRING_KEYS = new Set(["taxAssessmentType", "acquisitionDate", "saleDate"]);

export function applyAssistantPatch(project: object, patch: unknown): { changed: string[] } {
  const changed: string[] = [];
  mergeKnown(project as Record<string, unknown>, patch, "", changed);
  return { changed };
}

function mergeKnown(
  target: Record<string, unknown>,
  patch: unknown,
  prefix: string,
  changed: string[],
): void {
  if (!isPlainObject(patch)) return;

  for (const [key, value] of Object.entries(patch)) {
    if (!(key in target)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const current = target[key];

    if (isPlainObject(current) && isPlainObject(value)) {
      mergeKnown(current, value, path, changed);
      continue;
    }

    // Listor (t.ex. hiddenCosts, compareScenarios, momsrader) kräver egen
    // logik för att inte tappa poster av misstag — patchen rör dem inte.
    if (Array.isArray(current)) continue;

    if (typeof current === "number" && typeof value === "number" && Number.isFinite(value)) {
      if (current !== value) {
        target[key] = value;
        changed.push(path);
      }
      continue;
    }

    if (typeof current === "boolean" && typeof value === "boolean") {
      if (current !== value) {
        target[key] = value;
        changed.push(path);
      }
      continue;
    }

    if (typeof current === "string" && typeof value === "string") {
      if (current !== value) {
        target[key] = value;
        changed.push(path);
      }
      continue;
    }

    if (current === null) {
      const acceptsString = NULLABLE_STRING_KEYS.has(key) && typeof value === "string";
      const acceptsNumber = !NULLABLE_STRING_KEYS.has(key) && typeof value === "number" && Number.isFinite(value);
      if (acceptsString || acceptsNumber) {
        target[key] = value;
        changed.push(path);
      }
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
