import Image from "next/image";

const GITHUB_URL = "https://github.com/Builder106/Quarry";
const DEMO_GIF_URL = "/demo.gif";

const STATS = [
    {
        n: "188 B",
        label: "Yul runtime bytecode",
        note: "vs. 1.5–3 KB for a Solidity equivalent of the same dual-entry contract",
    },
    {
        n: "110k",
        label: "gas, two-hop arb",
        note: "against real Uniswap V2 + Sushiswap on forked mainnet",
    },
    {
        n: "99.89%",
        label: "prediction accuracy",
        note: "off-chain solver vs. on-chain realized profit, end-to-end",
    },
    {
        n: "0",
        label: "inventory required",
        note: "Aave V3 flashLoanSimple funds the back-run atomically",
    },
] as const;

const PIPELINE = [
    {step: "1", title: "WebSocket pending-tx", body: "subscribe via viem"},
    {step: "2", title: "Router filter", body: "Uniswap V2, Sushiswap, ignore the rest"},
    {step: "3", title: "Calldata decode", body: "four router methods, discriminated union"},
    {step: "4", title: "Multicall reserves", body: "Multicall3, one RPC round trip"},
    {step: "5", title: "Score the back-run", body: "apply victim → solve x* = (r·√K − R₁ᵢₙ·R₂ᵢₙ) / (r·(R₂ᵢₙ + r·R₁ₒᵤₜ))"},
    {step: "6", title: "Gate against gas", body: "refuse if profit ≤ premium + gasCost"},
    {step: "7", title: "Pack 220-byte calldata", body: "no ABI offsets, calldataload-friendly"},
    {step: "8", title: "Sign + bundle", body: "EIP-1559 → flashLoanSimple → Aave V3"},
    {step: "9", title: "Yul executes", body: "borrow → swap → swap → assert → approve → return"},
] as const;

const MODULES = [
    {area: "bot/src", items: ["amm.ts", "decode.ts", "pairs.ts", "reserves.ts", "score.ts", "gas.ts", "bundle.ts", "sign.ts", "scanner.ts"]},
    {area: "contracts/src", items: ["Executor.yul"]},
    {area: "bot/test", items: ["amm.test.ts", "decode.test.ts", "pairs.test.ts", "score.test.ts", "bundle.test.ts", "sign.test.ts", "flashloan.test.ts"]},
    {area: "contracts/test", items: ["Executor.t.sol", "ExecutorFork.t.sol", "ExecutorFlashloan.t.sol"]},
] as const;

export default function Home() {
    return (
        <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            {/* ---- Hero ---- */}
            <section>
                <picture>
                    <source media="(prefers-color-scheme: light)" srcSet="/banner-light.svg" />
                    <Image
                        src="/banner-dark.svg"
                        alt="Quarry — A bare-metal MEV arbitrage simulator"
                        width={1200}
                        height={420}
                        priority
                        className="w-full rounded-xl border border-[var(--color-border)]"
                    />
                </picture>

                <p className="mt-10 text-lg leading-relaxed text-[var(--color-text-muted)] sm:text-xl">
                    A hybrid MEV arbitrage engine. A TypeScript scanner watches Ethereum&apos;s
                    public mempool for swaps about to land on a Uniswap-V2-shaped DEX;
                    for each candidate it back-computes the price the victim will leave
                    behind, runs a closed-form optimal-input solver, and — if the
                    round-trip profit clears both fees and gas — signs an EIP-1559
                    transaction that borrows from Aave V3 and routes through a 188-byte
                    Yul executor.
                </p>
                <p className="mt-4 text-[var(--color-text-muted)]">
                    Every opcode shaved off the on-chain leg widens the marginal profit
                    envelope. That&apos;s the engineering thesis.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                    <a
                        href={GITHUB_URL}
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-gold)] bg-[var(--color-gold)] px-5 py-2.5 font-medium text-[var(--color-bg)] transition hover:bg-[var(--color-gold-deep)]"
                    >
                        View on GitHub
                        <span aria-hidden>↗</span>
                    </a>
                    <a
                        href="#demo"
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-5 py-2.5 font-medium text-[var(--color-text)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                    >
                        Watch the demo
                    </a>
                </div>

                <p className="mt-6 text-sm text-[var(--color-text-dim)]">
                    <span className="font-medium">Scope.</span> Quarry targets cross-DEX
                    arbitrage — closing price gaps the market would close anyway. The
                    kind of MEV broadly considered net-positive for on-chain price
                    efficiency. Predatory strategies (sandwiches, JIT against retail) are
                    out of scope.
                </p>
            </section>

            {/* ---- Stats ---- */}
            <section className="mt-20">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STATS.map((s) => (
                        <div
                            key={s.label}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-6"
                        >
                            <div className="font-mono text-3xl font-bold text-[var(--color-gold)]">
                                {s.n}
                            </div>
                            <div className="mt-1 font-medium text-[var(--color-text)]">
                                {s.label}
                            </div>
                            <div className="mt-2 text-sm text-[var(--color-text-dim)]">
                                {s.note}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ---- Pipeline ---- */}
            <section className="mt-20">
                <h2 className="text-2xl font-bold tracking-tight">
                    How it works
                </h2>
                <p className="mt-3 max-w-3xl text-[var(--color-text-muted)]">
                    Nine deterministic steps from a pending mempool transaction to a
                    signed Flashbots-shaped bundle. The off-chain side does all the
                    math; the on-chain Yul executor is monolithic — no Solidity, no
                    function dispatcher, no ABI decoding, just{" "}
                    <code className="font-mono text-[var(--color-gold)]">calldataload</code>
                    {" "}reads against a tightly packed 220-byte payload.
                </p>
                <ol className="mt-8 space-y-3">
                    {PIPELINE.map((step) => (
                        <li
                            key={step.step}
                            className="flex gap-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-gold)] font-mono text-sm text-[var(--color-gold)]">
                                {step.step}
                            </span>
                            <div>
                                <div className="font-medium text-[var(--color-text)]">
                                    {step.title}
                                </div>
                                <div className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                                    {step.body}
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
                <p className="mt-6 text-sm text-[var(--color-text-dim)]">
                    Pool 1&apos;s output flows directly to pool 2 (the canonical Uniswap V2
                    trick) — saving ~25k gas of intermediate ERC20 transfer. A
                    balance snapshot at entry and exit guards the trade: if the
                    arbitrage window closes between detection and inclusion, the whole
                    transaction reverts and only the base network fee is burned.
                </p>
            </section>

            {/* ---- Demo ---- */}
            <section id="demo" className="mt-20 scroll-mt-16">
                <h2 className="text-2xl font-bold tracking-tight">
                    Demo: end-to-end against forked mainnet
                </h2>
                <p className="mt-3 max-w-3xl text-[var(--color-text-muted)]">
                    The full pipeline runs against a local anvil fork. The bot holds zero
                    inventory; Aave V3 fronts the WETH and gets repaid atomically + 5 bp
                    premium inside the same transaction.
                </p>
                <div className="mt-8 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={DEMO_GIF_URL}
                        alt="bun run demo — back-run pipeline scoring a 1M-USDC victim swap, borrowing 5.3 WETH from Aave V3, netting 0.557 WETH net of premium against real Uniswap V2 + Sushiswap pools"
                        className="block w-full"
                        loading="lazy"
                    />
                </div>
                <pre className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4 font-mono text-sm leading-relaxed text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-text-dim)]"># Terminal 1 — fork mainnet at HEAD</span>
                    {"\n"}anvil --fork-url https://ethereum-rpc.publicnode.com
                    {"\n"}
                    {"\n"}<span className="text-[var(--color-text-dim)]"># Terminal 2 — run the pipeline</span>
                    {"\n"}cd bot
                    {"\n"}bun run demo
                </pre>
                <p className="mt-4 text-sm text-[var(--color-text-dim)]">
                    The 0.11% drift between net predicted and net realized is exactly the 2 bp
                    safety margin baked into the calldata builder for Uniswap V2&apos;s
                    K-invariant integer-arithmetic check —{" "}
                    <a
                        href={`${GITHUB_URL}/blob/main/JOURNAL.md`}
                        className="text-[var(--color-gold)] underline-offset-4 hover:underline"
                    >
                        documented in JOURNAL.md
                    </a>
                    .
                </p>
            </section>

            {/* ---- Modules ---- */}
            <section className="mt-20">
                <h2 className="text-2xl font-bold tracking-tight">What&apos;s in the repo</h2>
                <p className="mt-3 max-w-3xl text-[var(--color-text-muted)]">
                    Two intentionally independent trees. They communicate via deployed
                    contract address + ABI only — never via a shared TS package. Each
                    side has its own toolchain, its own test suite, its own gas/perf
                    budget.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {MODULES.map((m) => (
                        <div
                            key={m.area}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-5"
                        >
                            <div className="font-mono text-sm text-[var(--color-gold)]">
                                {m.area}
                            </div>
                            <ul className="mt-3 space-y-1 font-mono text-sm text-[var(--color-text-muted)]">
                                {m.items.map((i) => (
                                    <li key={i}>{i}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* ---- CTA ---- */}
            <section className="mt-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-8 text-center sm:p-12">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    188 bytes of Yul. 110k gas on real pools.
                </h2>
                <p className="mt-3 text-[var(--color-text-muted)]">
                    Read the JOURNAL for the incidents — selector bugs, K-invariant
                    boundary drift, whale-balance shortages — that shaped the design.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <a
                        href={GITHUB_URL}
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-gold)] bg-[var(--color-gold)] px-5 py-2.5 font-medium text-[var(--color-bg)] transition hover:bg-[var(--color-gold-deep)]"
                    >
                        Read the code on GitHub ↗
                    </a>
                    <a
                        href={`${GITHUB_URL}/blob/main/JOURNAL.md`}
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-5 py-2.5 font-medium text-[var(--color-text)] transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                    >
                        Open JOURNAL.md
                    </a>
                </div>
            </section>

            {/* ---- Footer ---- */}
            <footer className="mt-16 border-t border-[var(--color-border)] pt-8 text-sm text-[var(--color-text-dim)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <span className="font-mono">QUARRY · V3 · 2026</span>
                        {" · "}
                        <a
                            href={`${GITHUB_URL}/blob/main/LICENSE`}
                            className="hover:text-[var(--color-gold)]"
                        >
                            MIT License
                        </a>
                    </div>
                    <div className="font-mono">
                        Built with Next.js + Tailwind, deployed on Vercel.
                    </div>
                </div>
            </footer>
        </main>
    );
}
