"use client";

import { useEffect, useRef, useState } from "react";

export type FileRef = { name: string; type: string; size: number; sha256: string; url: string };

const MAX = 5;
const fmt = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Pick or record evidence files. Each one is uploaded (encrypted) as soon as it's chosen. */
export function Attachments({ value, onChange, onBusy }: { value: FileRef[]; onChange: (f: FileRef[]) => void; onBusy?: (b: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const list = useRef(value);
  list.current = value;

  useEffect(() => onBusy?.(uploading.length > 0 || !!rec), [uploading.length, rec, onBusy]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  async function upload(files: File[]) {
    setError("");
    for (const f of files) {
      if (list.current.length >= MAX) { setError(`You can attach up to ${MAX} files.`); break; }
      if (f.size > 4 * 1024 * 1024) { setError(`${f.name} is over 4 MB.`); continue; }
      setUploading((u) => [...u, f.name]);
      try {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "The upload failed.");
        onChange([...list.current, data.file]);
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
      setUploading((u) => u.filter((n) => n !== f.name));
    }
  }

  async function record() {
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const type = r.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        upload([new File(chunks, `voice-note-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.${ext}`, { type })]);
      };
      setSecs(0);
      r.start();
      setRec(r);
    } catch {
      setError("Microphone access was blocked. You can attach an audio file instead.");
    }
  }

  return (
    <div className="attach">
      <span className="attach-label">
        Photos, voice notes or files <span className="hint">(optional, up to {MAX}, 4 MB each)</span>
      </span>
      <div className="attach-buttons">
        <button type="button" className="button quiet" onClick={() => input.current?.click()} disabled={value.length >= MAX}>
          Add files
        </button>
        <button type="button" className={`button quiet${rec ? " recording" : ""}`} onClick={record}>
          {rec ? `Stop recording (${secs}s)` : "Record a voice note"}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="Add files"
          accept="image/*,audio/*,video/*,.pdf,.zip,.txt,.doc,.docx,.csv,.xlsx"
          onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>
      {(value.length > 0 || uploading.length > 0) && (
        <ul className="attach-list">
          {value.map((f, i) => (
            <li key={f.url}>
              <span className="attach-kind">{f.type.startsWith("image/") ? "Photo" : f.type.startsWith("audio/") ? "Audio" : f.type.startsWith("video/") ? "Video" : "File"}</span>
              <span className="attach-name">{f.name}</span>
              <span className="muted small">{fmt(f.size)}</span>
              <button type="button" className="attach-x" aria-label={`Remove ${f.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
          {uploading.map((n) => (
            <li key={n} className="muted"><span className="attach-kind">Uploading</span><span className="attach-name">{n}</span></li>
          ))}
        </ul>
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
