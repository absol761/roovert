import { size, contentType, alt, renderShareImage } from "./opengraph-image";

// Next.js's Twitter card image file convention. Twitter/X reads its own
// twitter:image tag rather than falling back to og:image in all clients, so
// this file exists to guarantee a correct card preview; it reuses the exact
// same render function as opengraph-image.tsx to avoid duplicating the design.

export { size, contentType, alt };

export default function Image() {
  return renderShareImage();
}
