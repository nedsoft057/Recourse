import { fmtSize, kindOf, type Attachment } from "@/lib/files";

/** Shows a side's evidence files: photos inline, audio and video playable, the rest as downloads. */
export function EvidenceFiles({ token, side, files }: { token: string; side: string; files?: Attachment[] }) {
  if (!files?.length) return null;
  return (
    <ul className="evidence-files">
      {files.map((f, i) => {
        const src = `/api/file?token=${token}&side=${side}&i=${i}`;
        const k = kindOf(f.type);
        return (
          <li key={f.sha256 + i} className={`ef ef-${k}`}>
            {k === "image" && (
              <a href={src} target="_blank" rel="noreferrer">
                <img src={src} alt={f.name} loading="lazy" />
              </a>
            )}
            {k === "audio" && <audio controls preload="none" src={src} />}
            {k === "video" && <video controls preload="none" src={src} />}
            <a className="ef-name" href={src} target="_blank" rel="noreferrer">
              {f.name}
            </a>
            <span className="muted small">
              {fmtSize(f.size)} · fingerprint {f.sha256.slice(0, 10)}…
            </span>
          </li>
        );
      })}
    </ul>
  );
}
