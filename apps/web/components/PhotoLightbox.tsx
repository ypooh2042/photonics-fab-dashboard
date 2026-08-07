"use client";

import { useState } from "react";
import { displayFilename } from "@/lib/photo-display";

export interface LightboxPhoto {
  id: number;
  filename: string;
  caption: string | null;
}

export default function PhotoLightbox({ photos }: { photos: LightboxPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const current = openIndex !== null ? photos[openIndex] : null;
  const isPdf = current?.filename.toLowerCase().endsWith(".pdf");

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setOpenIndex(i)}
            className="w-20 h-20 rounded-md overflow-hidden border border-black/10 dark:border-white/15"
            title={p.caption ?? displayFilename(p.filename)}
          >
            {p.filename.toLowerCase().endsWith(".pdf") ? (
              <div className="w-full h-full flex items-center justify-center text-xs opacity-60">
                PDF
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${p.id}`}
                alt={p.caption ?? displayFilename(p.filename)}
                className="w-full h-full object-cover"
              />
            )}
          </button>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpenIndex(null)}
        >
          <div className="max-w-3xl max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {isPdf ? (
              <a
                href={`/api/photos/${current.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-white underline"
              >
                {displayFilename(current.filename)} 열기
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${current.id}`}
                alt={current.caption ?? displayFilename(current.filename)}
                className="max-w-full max-h-[75vh] object-contain rounded-md"
              />
            )}
            <div className="text-white text-sm flex items-center gap-4">
              {openIndex! > 0 && (
                <button onClick={() => setOpenIndex((i) => (i! > 0 ? i! - 1 : i))}>← 이전</button>
              )}
              <span>{current.caption ?? displayFilename(current.filename)}</span>
              {openIndex! < photos.length - 1 && (
                <button onClick={() => setOpenIndex((i) => (i! < photos.length - 1 ? i! + 1 : i))}>
                  다음 →
                </button>
              )}
              <button onClick={() => setOpenIndex(null)} className="opacity-70">
                닫기 ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
