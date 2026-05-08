type Params = { subdomain: string }

export default async function PersonalSitePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { subdomain } = await params
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">Personal site</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Site: <span className="font-mono">{subdomain}.iam.bio</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Subdomain param: <span className="font-mono">{subdomain}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Scaffolded by sub-agent 1. To be built by sub-agent 4 (personal sites factory).
      </p>
    </main>
  )
}
