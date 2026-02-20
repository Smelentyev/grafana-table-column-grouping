import configFactory from './.config/webpack/webpack.config.ts';

export default async (env = {}) => {
  const config = await configFactory(env);
  config.entry = { module: './module.ts' };
  return config;
};
