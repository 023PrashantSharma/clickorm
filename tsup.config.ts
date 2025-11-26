import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  external: ['@clickhouse/client'],
  outDir: 'dist',
  target: 'node20',
  tsconfig: 'tsconfig.build.json',
});