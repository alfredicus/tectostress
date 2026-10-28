// hash.ts
// Deterministic hashing for cache keys and provenance ids.

/** JSON with object keys sorted, so equal values always give the same string. */
export function stableStringify(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort()
        .filter(k => obj[k] !== undefined)
        .map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
        .join(',')}}`;
}

/** cyrb53: fast, well-distributed 53-bit string hash, returned as hex. Not cryptographic. */
export function hashString(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function hashValue(value: unknown): string {
    return hashString(stableStringify(value));
}
