// Keeping the workflow in the browser (doc/workflow-spec.md §15)

import { GuardedValue, KeyValueStore, prefixedStorage, pushRecent, readRecent, RECENT_LIMIT } from '../browserStore';

class MemoryStore implements KeyValueStore {
    data = new Map<string, string>();
    failing = false;
    getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
    setItem(k: string, v: string) { if (this.failing) throw new Error('QuotaExceededError'); this.data.set(k, v); }
    removeItem(k: string) { this.data.delete(k); }
}

describe('one page', () => {
    test('writes, reads back, and skips identical writes', () => {
        const store = new MemoryStore();
        const page = new GuardedValue(store, 'wf');
        expect(page.read()).toBeNull();
        expect(page.write('A').status).toBe('saved');
        expect(page.write('A').status).toBe('unchanged');
        expect(page.write('B').status).toBe('saved');
        expect(new GuardedValue(store, 'wf').read()).toBe('B');
    });

    test('older storage, without revision, is read and written normally', () => {
        const store = new MemoryStore();
        store.setItem('wf', 'old');
        const page = new GuardedValue(store, 'wf');
        expect(page.read()).toBe('old');
        expect(page.write('new').status).toBe('saved');
    });

    test('a failure is reported, not ignored', () => {
        const store = new MemoryStore();
        const page = new GuardedValue(store, 'wf');
        store.failing = true;
        expect(page.write('A')).toEqual({ status: 'failed', error: 'QuotaExceededError' });
        store.failing = false;
        expect(page.write('A').status).toBe('saved');
    });
});

describe('two pages', () => {
    test('a page holding an older version never overwrites a newer one silently', () => {
        const store = new MemoryStore();
        const first = new GuardedValue(store, 'wf');
        const second = new GuardedValue(store, 'wf');
        first.read(); second.read();
        expect(first.write('built in the first page').status).toBe('saved');

        // The second page, still showing the old workflow, is edited
        const outcome = second.write('old, edited in the second page');
        expect(outcome.status).toBe('conflict');
        expect(store.getItem('wf')).toBe('built in the first page');
        expect(second.changedElsewhere()?.page).toBe(first.page);
        // and the first page is not in conflict with itself
        expect(first.changedElsewhere()).toBeNull();
    });

    test('the user chooses: keep this one (force), or read the other version', () => {
        const store = new MemoryStore();
        const first = new GuardedValue(store, 'wf');
        const second = new GuardedValue(store, 'wf');
        first.write('first');
        expect(second.write('second').status).toBe('conflict');
        expect(second.write('second', true).status).toBe('saved');
        expect(store.getItem('wf')).toBe('second');
        // Now the first page is the one told
        expect(first.write('first again').status).toBe('conflict');
        expect(first.read()).toBe('second');
        expect(first.write('first, from the second version').status).toBe('saved');
    });
});

describe('recent workflows', () => {
    test('most recent first, no duplicates, at most the limit', () => {
        const store = new MemoryStore();
        const entry = (n: number) => ({ name: `W${n}`, keptAt: '', blocks: n, json: `{"n":${n}}` });
        for (let n = 1; n <= RECENT_LIMIT + 3; n++) pushRecent(store, 'recent', entry(n));
        pushRecent(store, 'recent', entry(RECENT_LIMIT));
        const list = readRecent(store, 'recent');
        expect(list).toHaveLength(RECENT_LIMIT);
        expect(list[0].name).toBe(`W${RECENT_LIMIT}`);
        expect(new Set(list.map(r => r.json)).size).toBe(RECENT_LIMIT);
        expect(readRecent(new MemoryStore(), 'recent')).toEqual([]);
    });
});

test('a sandbox sees only its own keys', () => {
    const data = new Map<string, string>([['tectostress-workflow', 'user']]);
    const base = {
        get length() { return data.size; },
        key: (i: number) => Array.from(data.keys())[i] ?? null,
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => { data.set(k, v); },
        removeItem: (k: string) => { data.delete(k); },
        clear: () => data.clear(),
    } as Storage;
    const sandbox = prefixedStorage(base, 'sandbox:');
    expect(sandbox.getItem('tectostress-workflow')).toBeNull();
    sandbox.setItem('tectostress-workflow', 'test');
    sandbox.clear();
    expect(data.get('tectostress-workflow')).toBe('user');
    expect(sandbox.length).toBe(0);
});
