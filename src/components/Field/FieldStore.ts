import { FieldRecord } from './types'

const STORAGE_KEY = 'tectostress-field-records'

export const FieldStore = {
    load(): FieldRecord[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return []
            return JSON.parse(raw) as FieldRecord[]
        } catch {
            return []
        }
    },

    save(records: FieldRecord[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    },

    add(record: FieldRecord): FieldRecord[] {
        const records = FieldStore.load()
        records.unshift(record)   // newest first
        FieldStore.save(records)
        return records
    },

    update(record: FieldRecord): FieldRecord[] {
        const records = FieldStore.load().map(r => r.id === record.id ? record : r)
        FieldStore.save(records)
        return records
    },

    remove(id: string): FieldRecord[] {
        const records = FieldStore.load().filter(r => r.id !== id)
        FieldStore.save(records)
        return records
    },

    clear(): void {
        localStorage.removeItem(STORAGE_KEY)
    },
}
