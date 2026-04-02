import fs from 'fs';
import path from 'path';
import type { Configuration } from 'webpack';
import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';

import baseConfig, { type Env } from './.config/webpack/webpack.config';

const resolveModuleEntry = () => {
  const tsEntry = path.resolve(process.cwd(), 'src', 'module.ts');
  if (fs.existsSync(tsEntry)) {
    return tsEntry;
  }

  return path.resolve(process.cwd(), 'src', 'module.tsx');
};

export default async (env: Env): Promise<Configuration> => {
  const config = await baseConfig(env);
  const currentEntry = typeof config.entry === 'object' && config.entry != null ? config.entry : {};
  const outputPath = typeof env.outputPath === 'string' ? env.outputPath : undefined;
  const disableCache = env.disableCache === true || env.disableCache === 'true';

  config.entry = {
    ...currentEntry,
    module: resolveModuleEntry(),
  };

  if (outputPath && config.output) {
    config.output.path = path.resolve(process.cwd(), outputPath);
    config.plugins = config.plugins?.filter((plugin) => !(plugin instanceof ReplaceInFileWebpackPlugin));
  }

  if (disableCache) {
    config.cache = false;
  }

  return config;
};
