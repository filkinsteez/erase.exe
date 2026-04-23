import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getSession } from "@/lib/session";
import { ensureCsrfToken } from "@/lib/csrf";
import { fetchAndStoreUserTimeline } from "@/lib/scan";
import { Archive } from "@/components/Archive";
import { LandingTerminal } from "@/components/LandingTerminal";
import { getDataConfig } from "@/lib/config";

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

  return <LandingTerminal oauthError={oauthError} severed={severed} mode={config.mode} />;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
