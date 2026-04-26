/** Expand ${VAR} and ${VAR:-default} in strings (YAML values). */
export function expandEnvString(input: string): string {
  return input.replace(
    /\$\{([^}:]+)(?::-([^}]*))?\}/g,
    (_m, name: string, def?: string) => {
      const v = process.env[name];
      if (v !== undefined && v !== "") return v;
      return def ?? "";
    }
  );
}

export function expandEnvDeep<T>(value: T): T {
  if (typeof value === "string") return expandEnvString(value) as T;
  if (Array.isArray(value)) return value.map((v) => expandEnvDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = expandEnvDeep(v);
    }
    return out as T;
  }
  return value;
}
