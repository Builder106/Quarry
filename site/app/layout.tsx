import type {Metadata} from "next";
import "./globals.css";

const SITE_URL = "https://quarry-mev.vercel.app";

export const metadata: Metadata = {
    title: "Quarry — A bare-metal MEV arbitrage simulator",
    description:
        "Hybrid MEV arbitrage engine. TypeScript scanner watches Ethereum's mempool, Yul executor runs a two-hop cross-DEX arb in 188 bytes of bytecode. Aave V3 flashloans, 99.89% prediction accuracy on forked mainnet.",
    metadataBase: new URL(SITE_URL),
    openGraph: {
        title: "Quarry — A bare-metal MEV arbitrage simulator",
        description:
            "188 bytes of Yul. 110k gas on real Uniswap V2 + Sushiswap pools. Aave V3 flashloans, no inventory required.",
        url: SITE_URL,
        siteName: "Quarry",
        images: [{url: "/banner-dark.svg", width: 1200, height: 420}],
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Quarry — A bare-metal MEV arbitrage simulator",
        description: "188 B Yul. 110k gas. Aave V3 flashloans.",
        images: ["/banner-dark.svg"],
    },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="en">
            <body className="min-h-screen">{children}</body>
        </html>
    );
}
