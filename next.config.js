/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Prevent bundling issues with 'canvas' (node-only)
    config.externals = [...(config.externals || []), { canvas: 'canvas', sharp: 'sharp' }];

    // Spark's package.json has "type":"module", so webpack treats all .js files as ESM
    // and `exports`/`require` become undefined. Force the CJS build to be parsed as
    // CommonJS (javascript/auto) so webpack injects its own module scope correctly.
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      // Force all three.js imports (ESM + CJS) to the same file so Spark's
      // ShaderChunk.splatDefines registration is visible to React Three Fiber.
      'three': path.resolve(__dirname, 'node_modules/three/build/three.module.js'),
      '@sparkjsdev/spark': path.resolve(__dirname, 'node_modules/@sparkjsdev/spark/dist/spark.cjs.js'),
    };
    config.module.rules.push({
      test: /spark\.cjs\.js$/,
      type: 'javascript/auto',
    });

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['@google/generative-ai'],
  },
};

module.exports = nextConfig;
