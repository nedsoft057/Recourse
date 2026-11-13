// Server-only helpers for reading from and writing to the Recourse contract.

const RPC = process.env.NEAR_RPC || "https://test.rpc.fastnear.com";
export const MASTER = process.env.NEAR_MASTER_ACCOUNT || "favour-recourse.testnet";
export const CONTRACT = process.env.RECOURSE_CONTRACT || `recourse.${MASTER}`;
export const TOKEN = process.env.RECOURSE_TOKEN || `usdc.${MASTER}`;
export const EXPLORER = "https://testnet.nearblocks.io";

export async function view<T>(method: string, args: object = {}, contract = CONTRACT): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "recourse",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: contract,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error?.cause?.name || json.error.message || "RPC error");
  if (json.result?.error) throw new Error(json.result.error);
  return JSON.parse(Buffer.from(json.result.result).toString());
}

type Outcome = {
  transaction: { hash: string };
  receipts_outcome: { outcome: { logs: string[]; status: any } }[];
};

/** Signs a function call as one of the demo accounts (they share the master key). */
export async function act(
  accountId: string,
  methodName: string,
  args: object,
  opts: { contract?: string; deposit?: bigint; tgas?: bigint } = {}
) {
  const key = process.env.NEAR_MASTER_KEY;
  if (!key) throw new Error("Server is missing NEAR_MASTER_KEY");
  const { connect, keyStores, KeyPair } = await import("near-api-js");
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", accountId, KeyPair.fromString(key as any));
  const near = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
  const account = await near.account(accountId);
  const out = (await account.functionCall({
    contractId: opts.contract || CONTRACT,
    methodName,
    args,
    gas: (opts.tgas ?? 100n) * 1_000_000_000_000n,
    attachedDeposit: opts.deposit ?? 0n,
  })) as unknown as Outcome;
  const logs = out.receipts_outcome.flatMap((r) => r.outcome.logs);
  const failures = out.receipts_outcome
    .map((r) => r.outcome.status?.Failure)
    .filter(Boolean)
    .map((f: any) => f?.ActionError?.kind?.FunctionCallError?.ExecutionError || JSON.stringify(f));
  const events = logs
    .filter((l) => l.startsWith("EVENT_JSON:"))
    .map((l) => JSON.parse(l.slice("EVENT_JSON:".length)));
  return { hash: out.transaction.hash, logs, events, failures };
}

/** Turns a contract panic into a sentence for the interface. */
export function cleanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.match(/Smart contract panicked: ([^"\\]+)/);
  return m ? m[1] : raw.slice(0, 200);
}
