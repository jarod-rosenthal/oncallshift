interface ScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

export function Screenshot({ src, alt, caption }: ScreenshotProps) {
  return (
    <figure className="my-6">
      <div className="rounded-lg border border-white/5 overflow-hidden shadow-sm">
        <img
          src={src}
          alt={alt}
          className="w-full h-auto"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

interface VideoEmbedProps {
  src: string;
  title?: string;
  caption?: string;
}

export function VideoEmbed({ src, title, caption }: VideoEmbedProps) {
  // Handle GIF as image
  if (src.endsWith('.gif')) {
    return (
      <figure className="my-6">
        <div className="rounded-lg border border-white/5 overflow-hidden shadow-sm">
          <img
            src={src}
            alt={title || 'Demo'}
            className="w-full h-auto"
          />
        </div>
        {caption && (
          <figcaption className="mt-2 text-center text-sm text-slate-500">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // Handle actual video embeds (placeholder for YouTube, etc.)
  return (
    <figure className="my-6">
      <div className="rounded-lg border border-white/5 overflow-hidden shadow-sm aspect-video bg-white/[0.03] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{title || 'Video placeholder'}</p>
        </div>
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
