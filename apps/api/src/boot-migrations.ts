// Whether the API process should apply database migrations on boot.
//
// In a managed deployment, migrations should be applied by a dedicated,
// gated step that runs as a schema-owner role *before* any service rolls out.
// The long-running API process should then connect as a DML-only role that
// can't run DDL on boot — applying DDL from a rolling app deploy can crash-loop
// the service. Such a deployment sets RUN_MIGRATIONS_ON_BOOT=false.
//
// Locally (overmind, plain `pnpm dev`) there's no separate migrate step, so the
// default is to run on boot — preserving the existing developer experience.
// Worktree bootstrap already migrates explicitly, so this only affects the
// main-checkout dev loop.
export function shouldRunMigrationsOnBoot(env: NodeJS.ProcessEnv): boolean {
  return env.RUN_MIGRATIONS_ON_BOOT !== "false";
}
