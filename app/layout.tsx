import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#050610" />
        <meta
          name="description"
          content="An open-world 3D street racing prototype built with React, TypeScript, and Three.js."
        />
        <title>Project // Street</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
