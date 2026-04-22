import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getSession } from "@/lib/session";
import { ensureCsrfToken } from "@/lib/csrf";
import { fetchAndStoreUserTimeline } from "@/lib/scan";
import { Archive } from "@/components/Archive";
import { getDataConfig, type DataMode } from "@/lib/config";

export const dynamic = "force-dynamic";

type PageSearchParams = {
  oauth_error?: string | string[];
  connected?: string | string[];
  severed?: string | string[];
};

export default async function Home({ searchParams }: { searchParams?: Promise<PageSearchParams> }) {
  const params = (await searchParams) ?? {};
  const oauthError = firstString(params.oauth_error);
  const severed = firstString(params.severed) === "1";

  const config = getDataConfig();

  let connected = false;
  let handle = "";
  let csrfToken: string | null = null;
  let bootstrapError: string | null = null;
  let creditsDepleted = false;

  try {
    const session = await getSession();
    if (session.connectedAccountId && session.userId && session.providerUserId) {
      const row = await getDb().query.connectedAccounts.findFirst({
        where: eq(schema.connectedAccounts.id, session.connectedAccountId)
      });
      if (row) {
        connected = true;
        handle = row.handle;
        csrfToken = await ensureCsrfToken();

        if (config.serverApiEnabled) {
          try {
            const result = await fetchAndStoreUserTimeline({
              userId: session.userId,
              connectedAccountId: session.connectedAccountId,
              providerUserId: session.providerUserId
            });
            creditsDepleted = result.creditsDepleted;
          } catch (error) {
            bootstrapError =
              error instanceof Error ? error.message : "Initial timeline fetch failed.";
          }
        }
      }
    }
  } catch (error) {
    console.warn("[home] session/db lookup failed", error);
  }

  if (connected && csrfToken) {
    return (
      <Archive
        handle={handle}
        csrfToken={csrfToken}
        bootstrapError={bootstrapError}
        creditsDepleted={creditsDepleted}
        mode={config.mode}
        archiveUploadEnabled={config.archiveUploadEnabled}
        byoKeyEnabled={config.byoKeyEnabled}
      />
    );
  }

  return <Landing oauthError={oauthError} severed={severed} mode={config.mode} />;
}

function Landing({
  oauthError,
  severed,
  mode
}: {
  oauthError?: string;
  severed: boolean;
  mode: DataMode;
}) {
  return (
    <main className="dos-main">
      <div className="dos-panel dos-landing">
        <header className="dos-panel-head">
          <span className="dos-brand">TWEET-DELETE</span>
          <span className="dos-dim">v0.1 / PUBLIC POSTS BROWSER</span>
        </header>

        <div className="dos-panel-body dos-stack">
          <p>
            Browse your old public X posts by year. Filter by keyword or date range.
            Read what you wrote a decade ago before deciding what to do about it.
          </p>
          {mode === "server" ? (
            <p className="dos-dim">
              Requires read access to your X account. Tokens are encrypted at rest.
              You can sever the link at any time.
            </p>
          ) : null}
          {mode === "user" ? (
            <p className="dos-dim">
              Step 1: connect X for identity only, we won&apos;t read tweets via the API.
              Step 2: upload your X data archive or paste your own API bearer on the next screen.
            </p>
          ) : null}
          {mode === "mixed" ? (
            <p className="dos-dim">
              Requires read access to your X account. If the server API is out of credits
              you can upload your X data archive or paste your own API bearer on the next screen.
            </p>
          ) : null}
        </div>

        <div className="dos-panel-head dos-panel-head-bottom">
          <span className="dos-brand">CONNECT</span>
          <span className="dos-dim">STEP 1 / 1</span>
        </div>
        <div className="dos-panel-body dos-stack">
          {severed ? (
            <p className="dos-ok">ACCESS SEVERED. Connect again to browse.</p>
          ) : null}
          {oauthError ? <p className="dos-error">OAUTH ERROR: {oauthError}</p> : null}
          <a className="dos-button" href="/api/x/oauth/start">
            [ Connect X account ]
          </a>
        </div>
      </div>
    </main>
  );
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
