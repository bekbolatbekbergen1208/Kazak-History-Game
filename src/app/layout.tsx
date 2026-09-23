import type { Metadata } from "next";
import "../styles.css";
import "../classroom.css";
export const metadata: Metadata = {
  title: "Тарихи миссия · Сыныптық архив",
  description:
    "Мұғалім басқаратын, оқушылар телефонмен қатысатын интерактивті тарихи зерттеу. Қазақстан 1900–1916.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="kk">
      <body>{children}</body>
    </html>
  );
}
