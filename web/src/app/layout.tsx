import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroSync — Edge AI Risk Intelligence",
  description: "AI-powered industrial risk intelligence for oil & gas infrastructure. Snapdragon Multiverse Hackathon.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="aurora" />
        {children}
      </body>
    </html>
  );
}
