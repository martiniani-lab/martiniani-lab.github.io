// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import geo from './integrations/geo.mjs';

export default defineConfig({
  site: 'https://martinianilab.org',
  output: 'static',
  integrations: [geo(), sitemap()],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
});
