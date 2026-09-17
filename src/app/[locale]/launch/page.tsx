import { Link } from "@/i18n/routing";
import { CHAIN_NAME, FAUCET_URL, NATIVE_SYMBOL, VALUES_ARE_REAL } from "@/lib/chain";
import { readLaunchTermsResult } from "@/lib/pons/terms";
import { getTheme } from "@/lib/themes";
import { LaunchFlow } from "@/components/LaunchFlow";
import { PageHeader } from "@/components/PageHeader";

/**
 * Terms are read on every request, never cached. They are Pons's to change and
 * a stale launch fee is a rejected transaction the user pays gas for.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Launch a token — JapanPad",
  description: "Create a Japan-themed token and launch it through Pons.",
};

export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const params = await searchParams;
  const initialTheme = params.theme && getTheme(params.theme) ? params.theme : null;

  const result = await readLaunchTermsResult();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageHeader jp="発行" title="Launch a token">
        Pick a theme, describe your token, and sign one transaction. Pons creates
        the token and its bonding curve on {CHAIN_NAME}. JapanPad never holds your
        funds and takes no cut of your creator fees.
      </PageHeader>

      {!result.ok ? (
        /*
         * Three different problems, three different messages. They used to
         * share two, and the shared one — "Pons could not be read right now" —
         * covered both a deploy pointed at the wrong address and an RPC having
         * a bad minute. Identical symptom, opposite fixes, no way to tell them
         * apart from the page. The address is printed for the same reason: the
         * fix for the misconfigured case is to compare it against the real one.
         */
        result.reason === "no-factory" ? (
          <Unavailable
            title={`No Pons factory is configured for ${CHAIN_NAME}.`}
            body="Set NEXT_PUBLIC_PONS_V2_FACTORY to the factory address on this network. Nothing can be launched until it points somewhere real."
          />
        ) : result.reason === "wrong-address" ? (
          <Unavailable
            title="The configured address is not a Pons factory."
            body={`${CHAIN_NAME} answered, and there is no Pons factory at ${result.address}. This is a configuration problem rather than an outage: check NEXT_PUBLIC_PONS_V2_FACTORY, or unset it to fall back to the address this build verified. Run \`npm run verify:pons\` to check an address against the live chain.`}
          />
        ) : (
          <Unavailable
            title="Pons could not be read right now."
            body={`The launch fee and curve terms come from the factory on ${CHAIN_NAME}, and they change. ${CHAIN_NAME} did not answer — this is an outage or a rate limit rather than a misconfiguration. Rather than guess the terms and have your transaction rejected, this form stays closed until the chain answers.`}
          />
        )
      ) : (
        <>
          {!VALUES_ARE_REAL ? (
            <p className="mb-6 text-sm text-sumi/80 bg-sakura/15 border border-sakura/40 rounded-lg px-4 py-3">
              This is {CHAIN_NAME}. Anything launched here is a test and carries no value.
              {FAUCET_URL ? (
                <>
                  {" "}
                  <a
                    href={FAUCET_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline hover:text-vermilion"
                  >
                    Get test {NATIVE_SYMBOL}
                  </a>
                  .
                </>
              ) : null}
            </p>
          ) : null}

          <LaunchFlow
            initialThemeId={initialTheme}
            launchEnabled={result.terms.launchEnabled && result.terms.configEnabled}
            launchFeeWei={result.terms.launchFeeWei.toString()}
            supply={result.terms.supply.toString()}
            graduationThresholdWei={result.terms.graduationThresholdWei.toString()}
            curveFeeBps={result.terms.curveFeeBps}
          />
        </>
      )}

      <p className="mt-10 text-xs text-muted/90 leading-relaxed border-l-2 border-rule pl-4">
        A JapanPad token is a user-created crypto token themed around Japanese culture. It
        is not a share in any company, is not affiliated with or endorsed by any company
        you may reference, and confers no ownership, dividends, voting rights, or claim on
        any business. Most tokens launched on bonding curves lose value. Never spend more
        than you can afford to lose.
      </p>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-8">
      <p className="font-display text-lg">{title}</p>
      <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
      <Link href="/explore" className="inline-block mt-4 text-sm text-vermilion hover:underline">
        Browse what is already launched →
      </Link>
    </div>
  );
}
