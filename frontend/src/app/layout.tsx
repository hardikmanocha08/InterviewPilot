import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewPilot",
  description: "AI-powered interview practice with timed and untimed mock sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (() => {
      try {
        const saved = localStorage.getItem('theme');
        if (saved === 'light') {
          document.documentElement.classList.add('theme-light');
        } else {
          document.documentElement.classList.remove('theme-light');
        }
      } catch (_) {}
    })();
  `;

  return (
    <html lang="en">
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
