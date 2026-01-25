import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.segment.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.segment.io",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin'
          }
        ],
      },
    ];
  },
  
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,
  
  // Enable React strict mode
  reactStrictMode: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: [],
  },
  
  // Webpack config for R3F compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const path = require('path');
      const fs = require('fs');
      const reactPath = require.resolve('react');
      const reactDomPath = require.resolve('react-dom');
      config.resolve.alias = {
        ...config.resolve.alias,
        'react': reactPath,
        'react-dom': reactDomPath,
      };
      const reactDomDir = path.dirname(reactDomPath);
      const reactDomClientPath = path.join(reactDomDir, 'client.js');
      if (fs.existsSync(reactDomClientPath)) {
        config.resolve.alias['react-dom/client'] = reactDomClientPath;
      }
    }
    return config;
  },
  
  // Turbopack config - empty to allow webpack config to work
  turbopack: {},
};

export default nextConfig;
