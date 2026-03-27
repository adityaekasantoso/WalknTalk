import "./globals.css";
import { SocketProviderWrapper } from "./providers";

export const metadata = {
  title: "WalknTalk",
  description: "Real-time voice call application",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SocketProviderWrapper>{children}</SocketProviderWrapper>
      </body>
    </html>
  );
}
