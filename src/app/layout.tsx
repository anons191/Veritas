// src/app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <WalletConnectionProvider>
          {children}
        </WalletConnectionProvider>
      </body>
    </html>
  );
}

