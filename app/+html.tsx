import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

// Web-only HTML root. Inject a working @font-face for the Ionicons glyph font
// (vector-icons uses font-family "ionicons" on web but its auto-injected src 404s
// in static exports). We serve a stable copy at /fonts/ionicons.ttf (copied post-build).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
@font-face { font-family: 'ionicons'; src: url('/fonts/ionicons.ttf') format('truetype'); font-display: block; }
@font-face { font-family: 'Ionicons'; src: url('/fonts/ionicons.ttf') format('truetype'); font-display: block; }
html, body { background-color: #A6E63D; }
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
