// browserStore.ts
// Keeping the workflow in the browser without losing it (doc/workflow-spec.md §15).
//
// The workflow is kept under one key, with a revision under another. Each page (tab or window)
// remembers the revision it read or wrote last; before writing, it checks that nobody wrote since.
// If another page did, nothing is overwritten: the user chooses which version to keep.

/** The part of `Storage` used here, so tests can pass their own */
export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface StoredRevision {
    /** Changes at every write */
    revision: string;
    /** Page that wrote it */
    page: string;
    savedAt: string;
}

export type WriteOutcome =
    | { status: 'saved'; revision: string }
    | { status: 'unchanged' }
    /** Another page wrote since this one last read or wrote: nothing was written */
    | { status: 'conflict'; other: StoredRevision }
    | { status: 'failed'; error: string };

export interface RecentWorkflow {
    name: string;
    /** When it was replaced */
    keptAt: string;
    blocks: number;
    json: string;
}

export const RECENT_LIMIT = 10;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * One value kept in browser storage, written only over the version this page knows.
 * `key` holds the value, `key + '-revision'` its revision.
 */
export class GuardedValue {
    readonly page: string;
    private known: string | null;
    private lastWritten: string | null = null;

    constructor(private store: KeyValueStore, readonly key: string, page = newId()) {
        this.page = page;
        this.known = this.storedRevision()?.revision ?? null;
    }

    get revisionKey() { return `${this.key}-revision`; }

    storedRevision(): StoredRevision | null {
        try {
            const raw = this.store.getItem(this.revisionKey);
            const r = raw ? JSON.parse(raw) : null;
            return r && typeof r.revision === 'string' ? r : null;
        } catch {
            return null;
        }
    }

    /** The stored value; this page now knows its revision */
    read(): string | null {
        try {
            const value = this.store.getItem(this.key);
            this.known = this.storedRevision()?.revision ?? null;
            this.lastWritten = value;
            return value;
        } catch {
            return null;
        }
    }

    /** True when another page wrote since this page last read or wrote */
    changedElsewhere(): StoredRevision | null {
        const stored = this.storedRevision();
        return stored && stored.revision !== this.known && stored.page !== this.page ? stored : null;
    }

    /** Write `value`, unless another page wrote since (then `force` to overwrite) */
    write(value: string, force = false): WriteOutcome {
        try {
            const other = this.changedElsewhere();
            if (other && !force) return { status: 'conflict', other };
            if (!other && value === this.lastWritten) return { status: 'unchanged' };
            const revision: StoredRevision = { revision: newId(), page: this.page, savedAt: new Date().toISOString() };
            this.store.setItem(this.key, value);
            this.store.setItem(this.revisionKey, JSON.stringify(revision));
            this.known = revision.revision;
            this.lastWritten = value;
            return { status: 'saved', revision: revision.revision };
        } catch (e) {
            return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
        }
    }
}

/** Workflows replaced by New, a predefined workflow, Load…, most recent first (§15.2.4) */
export function readRecent(store: KeyValueStore, key: string): RecentWorkflow[] {
    try {
        const list = JSON.parse(store.getItem(key) || '[]');
        return Array.isArray(list) ? list.filter(r => r && typeof r.json === 'string') : [];
    } catch {
        return [];
    }
}

/** Keep `entry` first in the recent list (an identical one is moved, not repeated) */
export function pushRecent(store: KeyValueStore, key: string, entry: RecentWorkflow): RecentWorkflow[] {
    const list = [entry, ...readRecent(store, key).filter(r => r.json !== entry.json)].slice(0, RECENT_LIMIT);
    try { store.setItem(key, JSON.stringify(list)); } catch { /* reported by the caller's next write */ }
    return list;
}

// ---- Sandbox (§15.2.5) ---------------------------------------------------------------------

export const SANDBOX_PREFIX = 'sandbox:';

/** Storage seen through a prefix: a page opened with `?sandbox` never touches the user's data */
export function prefixedStorage(base: Storage, prefix: string): Storage {
    const own = () => {
        const keys: string[] = [];
        for (let i = 0; i < base.length; i++) {
            const k = base.key(i);
            if (k && k.startsWith(prefix)) keys.push(k.slice(prefix.length));
        }
        return keys;
    };
    return {
        get length() { return own().length; },
        key: (i: number) => own()[i] ?? null,
        getItem: (k: string) => base.getItem(prefix + k),
        setItem: (k: string, v: string) => base.setItem(prefix + k, v),
        removeItem: (k: string) => base.removeItem(prefix + k),
        clear: () => own().forEach(k => base.removeItem(prefix + k)),
    };
}

/**
 * With `?sandbox` in the address, the whole application uses its own storage. Called once, before
 * the application starts. Returns true when the page is a sandbox.
 */
export function installSandboxStorage(win: Window = window): boolean {
    if (!new URLSearchParams(win.location.search).has('sandbox')) return false;
    // Once only: a hot reload runs this again, and must not wrap the sandbox in a second one
    const w = win as Window & { __tectostressSandbox?: boolean };
    if (w.__tectostressSandbox) return true;
    w.__tectostressSandbox = true;
    const sandboxed = prefixedStorage(win.localStorage, SANDBOX_PREFIX);
    Object.defineProperty(win, 'localStorage', { configurable: true, get: () => sandboxed });
    return true;
}
