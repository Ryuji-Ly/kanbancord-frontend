/**
 * A screenshot in a guide. Screenshots are taken at twice the size they are shown, so they stay
 * sharp on high-density screens; `width` and `height` are the file's own size, so the page keeps
 * its place while the image loads.
 */
export function GuideImage({
  src,
  alt,
  width,
  height,
  caption,
  narrow = false,
}: {
  src: string
  alt: string
  width: number
  height: number
  caption?: string
  /** A tall, narrow screenshot (a side panel) shown at a readable size rather than full width. */
  narrow?: boolean
}) {
  return (
    <figure className={`kc-guide-figure${narrow ? ' kc-guide-figure--narrow' : ''}`}>
      {/* Wide screenshots are small at the article's width; clicking opens them at full size. */}
      <a href={src} target="_blank" rel="noopener">
        <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      </a>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
