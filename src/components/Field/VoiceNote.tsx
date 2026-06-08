import React, { useEffect, useRef, useState } from 'react'

interface Props {
    value?: string                              // existing recording as a data-URI
    onChange: (audio: string | undefined) => void
}

const recorderSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof (window as any).MediaRecorder !== 'undefined'

/**
 * Record / play back / delete a single voice note using the Web MediaRecorder
 * API (works in the browser and in the Capacitor WebView on recent iOS/Android).
 * The recording is returned to the parent as a base64 data-URI.
 */
export default function VoiceNote({ value, onChange }: Props) {
    const [recording, setRecording] = useState(false)
    const [elapsed, setElapsed] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Stop the timer / recorder if the component unmounts mid-recording.
    useEffect(() => () => {
        if (timerRef.current) clearInterval(timerRef.current)
        recorderRef.current?.stream.getTracks().forEach(t => t.stop())
    }, [])

    async function start() {
        setError(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mr = new MediaRecorder(stream)
            chunksRef.current = []
            mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
            mr.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
                const reader = new FileReader()
                reader.onloadend = () => onChange(reader.result as string)
                reader.readAsDataURL(blob)
                stream.getTracks().forEach(t => t.stop())
            }
            mr.start()
            recorderRef.current = mr
            setRecording(true)
            setElapsed(0)
            timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
        } catch (e: any) {
            setError(e?.message ?? 'Microphone unavailable')
        }
    }

    function stop() {
        recorderRef.current?.stop()
        recorderRef.current = null
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setRecording(false)
    }

    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

    if (!recorderSupported) {
        return (
            <p className="text-xs text-gray-400">Voice recording isn’t available on this device/browser.</p>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {error && <p className="text-sm text-red-500">{error}</p>}

            {recording ? (
                <button
                    onClick={stop}
                    className="flex items-center gap-2 self-start px-4 py-2 rounded-lg bg-red-600 text-white font-medium shadow"
                >
                    <span className="w-3 h-3 rounded-sm bg-white animate-pulse" />
                    Stop · {mmss(elapsed)}
                </button>
            ) : value ? (
                <div className="flex items-center gap-3">
                    <audio src={value} controls className="h-9" />
                    <button onClick={start} className="text-xs text-blue-500 underline">Re-record</button>
                    <button onClick={() => onChange(undefined)} className="text-xs text-red-500 underline">Delete</button>
                </div>
            ) : (
                <button
                    onClick={start}
                    className="flex items-center gap-2 self-start px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-400 hover:text-blue-400 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-14 0m7 7v3m0-3a4 4 0 01-4-4V7a4 4 0 118 0v4a4 4 0 01-4 4z" />
                    </svg>
                    Record voice note
                </button>
            )}
        </div>
    )
}
