// Quarry MEV arbitrage executor — bare-metal Yul.
//
// V3: adds Aave V3 `executeOperation` entry point alongside the direct V2
// entry, so the bot can run inventory-free via flashloans. Dispatch is by
// selector at calldata[0..4]: 0x1b11d0ff = executeOperation, anything else
// = the V2 direct path. Both paths share the swap orchestration logic via
// the `runArb` Yul function — the only differences are pre-flight (the
// flashloan path transfers the borrowed asset to pool1 first) and the
// post-arb settlement (the flashloan path approves Aave to pull back
// amount + premium and checks net profit against `premium + minProfit`).
//
// V2 packed calldata (220 bytes, used by both paths):
//   bytes   0..20  : address pool1
//   bytes  20..40  : address pool2
//   bytes  40..72  : uint256 amount0Out for pool1
//   bytes  72..104 : uint256 amount1Out for pool1
//   bytes 104..136 : uint256 amount0Out for pool2
//   bytes 136..168 : uint256 amount1Out for pool2
//   bytes 168..188 : address tokenIn        (must equal `asset` on V3 path)
//   bytes 188..220 : uint256 minProfit
//
// For the V3 path, the params bytes argument carries this same 220-byte
// payload — extracted from calldata[196..416].
//
// Storage:
//   slot 0 : address owner

object "QuarryExecutor" {
    // ---- Constructor ----
    code {
        sstore(0, caller())
        let size := datasize("runtime")
        datacopy(0, dataoffset("runtime"), size)
        return(0, size)
    }

    // ---- Runtime ----
    object "runtime" {
        code {
            // Dispatch on the first 4 bytes. The V2 direct calldata starts
            // with pool1's address — the chance of its first 4 bytes
            // colliding with 0x1b11d0ff is 1/2^32, which is fine for an MEV
            // bot. We additionally require calldatasize() == 220 on the
            // direct path to defend against malformed inputs.
            let sel := shr(224, calldataload(0))

            switch sel
            case 0x1b11d0ff {
                // ---------- Aave V3 executeOperation entry ----------
                // executeOperation(address asset, uint256 amount,
                //                  uint256 premium, address initiator,
                //                  bytes params)

                // Caller must be the Aave V3 mainnet pool. Test deployments
                // can use `vm.etch` to put mock bytecode at this address so
                // the auth check still passes.
                if iszero(eq(caller(), 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2)) {
                    revert(0, 0)
                }
                // Initiator must be the owner — i.e., the original sender to
                // Aave's flashLoanSimple. Aave passes msg.sender as initiator.
                if iszero(eq(calldataload(100), sload(0))) { revert(0, 0) }

                let asset := calldataload(4)
                let amount := calldataload(36)
                let premium := calldataload(68)

                // params content starts at offset 196 (4 selector + 5×32 fixed
                // args + 32 length). The 220-byte packed payload follows.
                let pool1 := shr(96, calldataload(196))
                let pool2 := shr(96, calldataload(216))
                let a0p1 := calldataload(236)
                let a1p1 := calldataload(268)
                let a0p2 := calldataload(300)
                let a1p2 := calldataload(332)
                // params[168..188] = tokenIn (must equal `asset`)
                if iszero(eq(shr(96, calldataload(364)), asset)) { revert(0, 0) }
                let minProfit := calldataload(384)

                // Snapshot balance BEFORE — this is the post-Aave-transfer
                // amount (Aave has already sent us `amount`).
                let balanceBefore := erc20BalanceOf(asset, address())

                // Transfer the borrowed asset to pool1 to satisfy leg-1's
                // K-invariant requirement.
                erc20Transfer(asset, pool1, amount)

                // Orchestrate the two swaps (shared with the V2 direct path).
                runSwaps(pool1, pool2, a0p1, a1p1, a0p2, a1p2)

                let balanceAfter := erc20BalanceOf(asset, address())
                if lt(balanceAfter, balanceBefore) { revert(0, 0) }
                let netGain := sub(balanceAfter, balanceBefore)

                // The bot needs to cover Aave's premium and still meet
                // minProfit. The pull-back of `amount` is automatic — Aave
                // does `transferFrom(executor, pool, amount + premium)` after
                // we return. We just need to approve.
                if lt(netGain, add(premium, minProfit)) { revert(0, 0) }

                // Approve Aave to pull back amount + premium.
                erc20Approve(asset, 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2, add(amount, premium))

                // Return true (32 bytes, value 1).
                mstore(0x00, 1)
                return(0x00, 0x20)
            }
            default {
                // ---------- V2 direct entry (legacy) ----------
                if iszero(eq(calldatasize(), 220)) { revert(0, 0) }
                if iszero(eq(caller(), sload(0))) { revert(0, 0) }

                let pool1 := shr(96, calldataload(0))
                let pool2 := shr(96, calldataload(20))
                let a0p1 := calldataload(40)
                let a1p1 := calldataload(72)
                let a0p2 := calldataload(104)
                let a1p2 := calldataload(136)
                let tokenIn := shr(96, calldataload(168))
                let minProfit := calldataload(188)

                let balanceBefore := erc20BalanceOf(tokenIn, address())

                runSwaps(pool1, pool2, a0p1, a1p1, a0p2, a1p2)

                let balanceAfter := erc20BalanceOf(tokenIn, address())
                if lt(balanceAfter, balanceBefore) { revert(0, 0) }
                let profit := sub(balanceAfter, balanceBefore)
                if lt(profit, minProfit) { revert(0, 0) }

                mstore(0x00, profit)
                return(0x00, 0x20)
            }

            // ---- Shared helpers ----

            // ERC20.balanceOf(account) selector = 0x70a08231
            function erc20BalanceOf(token, account) -> bal {
                mstore(0x00, 0x70a0823100000000000000000000000000000000000000000000000000000000)
                mstore(0x04, account)
                if iszero(staticcall(gas(), token, 0x00, 0x24, 0x40, 0x20)) { revert(0, 0) }
                bal := mload(0x40)
            }

            // ERC20.transfer(to, amount) selector = 0xa9059cbb
            function erc20Transfer(token, to, amount) {
                mstore(0x00, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, to)
                mstore(0x24, amount)
                if iszero(call(gas(), token, 0, 0x00, 0x44, 0x00, 0x00)) { revert(0, 0) }
            }

            // ERC20.approve(spender, amount) selector = 0x095ea7b3
            function erc20Approve(token, spender, amount) {
                mstore(0x00, 0x095ea7b300000000000000000000000000000000000000000000000000000000)
                mstore(0x04, spender)
                mstore(0x24, amount)
                if iszero(call(gas(), token, 0, 0x00, 0x44, 0x00, 0x00)) { revert(0, 0) }
            }

            // Uniswap V2 IUniswapV2Pair.swap selector = 0x022c0d9f.
            // Calldata layout: selector + amount0Out + amount1Out + to + 0x80 + 0x00 (empty bytes).
            // Total: 0xa4 (164) bytes. Inter-hop optimization: between hop 1 and hop 2,
            // selector / 0x80 offset / 0x00 length stay valid in memory, only
            // amounts and recipient change.
            function runSwaps(pool1, pool2, a0p1, a1p1, a0p2, a1p2) {
                mstore(0x00, 0x022c0d9f00000000000000000000000000000000000000000000000000000000)
                mstore(0x04, a0p1)
                mstore(0x24, a1p1)
                mstore(0x44, pool2)
                mstore(0x64, 0x80)
                mstore(0x84, 0x00)
                if iszero(call(gas(), pool1, 0, 0x00, 0xa4, 0x00, 0x00)) { revert(0, 0) }

                mstore(0x04, a0p2)
                mstore(0x24, a1p2)
                mstore(0x44, address())
                if iszero(call(gas(), pool2, 0, 0x00, 0xa4, 0x00, 0x00)) { revert(0, 0) }
            }
        }
    }
}
