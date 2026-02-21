import fs from 'fs';
import path from 'path';
import type { Configuration } from 'webpack';

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

  config.entry = {
    ...currentEntry,
    module: resolveModuleEntry(),
  };

  return config;
};
