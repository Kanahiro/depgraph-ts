# Project Dependency Map

`pdm` statically maps ESM import dependencies in TypeScript and JavaScript projects without executing the target project.

```bash
pnpm install
pnpm build
node dist/cli.js analyze . --group-depth 2 --format mermaid --output dependency-map.mmd
```

The CLI supports `--include`, `--exclude`, `--group-depth`, `--format json|mermaid`, `--output`, and `--tsconfig`.

Save two JSON snapshots and compare them without re-analyzing either project:

```bash
pdm analyze . --format json --output before.json
# change the project
pdm analyze . --format json --output after.json
pdm diff before.json after.json --format mermaid --output dependency-diff.mmd
```

`diff` reports added, removed, and changed directory nodes and dependency edges. Both snapshots must use the same `groupDepth`.

To compare two checked-out project trees directly, use `compare`:

```bash
pdm compare path/to/base path/to/head --format mermaid
```

The included GitHub Actions workflow checks out the pull request base and head, runs `compare`, and renders the Mermaid diff in the job summary.

The library uses one rendering API for both maps and diffs:

```ts
import { analyze, diffMaps, render } from "project-dependency-map";

const current = await analyze(".");
const json = render(current, "json");
const mermaid = render(current, "mermaid");
```

Static ESM imports and re-exports are analyzed. Relative paths, `compilerOptions.paths`, `baseUrl`, extensions, and `index` files are resolved. Unresolved internal imports are written to stderr while the analysis still exits successfully.
