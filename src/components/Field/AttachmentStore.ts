// Binary attachment storage backed by IndexedDB. Field records keep only small
// metadata (id, name, mime, size) in localStorage; the actual file bytes — which
// can be large, e.g. a LiDAR 3D scan — live here as Blobs, well beyond the
// ~5 MB localStorage quota.

const DB_NAME = 'tectostress-field'
const STORE = 'attachments'
const VERSION = 1

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, VERSION)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export const AttachmentStore = {
    async put(id: string, blob: Blob): Promise<void> {
        const db = await openDB()
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite')
                tx.objectStore(STORE).put(blob, id)
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
            })
        } finally { db.close() }
    },

    async get(id: string): Promise<Blob | undefined> {
        const db = await openDB()
        try {
            return await new Promise<Blob | undefined>((resolve, reject) => {
                const tx = db.transaction(STORE, 'readonly')
                const req = tx.objectStore(STORE).get(id)
                req.onsuccess = () => resolve(req.result as Blob | undefined)
                req.onerror = () => reject(req.error)
            })
        } finally { db.close() }
    },

    async remove(id: string): Promise<void> {
        const db = await openDB()
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite')
                tx.objectStore(STORE).delete(id)
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
            })
        } finally { db.close() }
    },

    async clear(): Promise<void> {
        const db = await openDB()
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite')
                tx.objectStore(STORE).clear()
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
            })
        } finally { db.close() }
    },

    // Delete any stored blob whose id is not in `referenced` — cleans up
    // orphans left by cancelled edits or deleted records.
    async gc(referenced: Set<string>): Promise<void> {
        const db = await openDB()
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite')
                const store = tx.objectStore(STORE)
                const keysReq = store.getAllKeys()
                keysReq.onsuccess = () => {
                    for (const key of keysReq.result as IDBValidKey[]) {
                        if (!referenced.has(String(key))) store.delete(key)
                    }
                }
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
            })
        } finally { db.close() }
    },
}
