// Human-readable byte size, e.g. 1536 → "1.5 KB", 12_500_000 → "11.9 MB".
export function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
    const value = bytes / Math.pow(1024, i)
    return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}
