/**
 * Astro integration that generates llms-full.txt at build time.
 * Reads src/content/geo.yaml + other data files and writes public/llms-full.txt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export default function geoIntegration() {
  return {
    name: 'geo-llms-full',
    hooks: {
      'astro:build:start': ({ logger }) => {
        const rootDir = process.cwd();
        logger.info('Generating llms-full.txt from geo.yaml and content files...');

        try {
          // Dynamically import at build time to avoid ESM/CJS issues
          // We'll generate inline since Astro integrations run before page builds
          const contentDir = join(rootDir, 'src/content');
          const geoContent = readFileSync(join(contentDir, 'geo.yaml'), 'utf-8');
          const geo = yaml.load(geoContent);

          const sections = [];

          // Header
          sections.push(`# Stefano Martiniani — Full Reference`);
          sections.push('');
          sections.push(`> ${geo.bio.short.trim()}`);
          sections.push('');
          sections.push(`For a concise overview, see: https://martinianilab.org/llms.txt`);
          sections.push('');

          // FAQ
          sections.push(`## Frequently Asked Questions`);
          sections.push('');
          for (const faq of geo.faq) {
            sections.push(`### ${faq.question}`);
            sections.push('');
            sections.push(faq.answer.trim());
            sections.push('');
          }

          // Full Biography
          sections.push(`## Full Biography`);
          sections.push('');
          sections.push(geo.bio.full.trim());
          sections.push('');

          // Research Areas
          sections.push(`## Research Areas`);
          sections.push('');
          for (const area of geo.research_areas) {
            sections.push(`### ${area.name}`);
            sections.push('');
            sections.push(area.summary.trim());
            sections.push('');
            sections.push('Key papers:');
            for (const paper of area.key_papers) {
              sections.push(`- ${paper}`);
            }
            sections.push('');
          }

          // Team
          const teamContent = readFileSync(join(contentDir, 'team.yaml'), 'utf-8');
          const team = yaml.load(teamContent);
          sections.push(`## Current Team`);
          sections.push('');
          const roleLabels = {
            pi: 'Principal Investigator',
            postdoc: 'Postdocs and Research Scientists',
            graduate: 'Graduate Students',
            staff: 'Research Staff',
            undergraduate: 'Undergraduates',
          };
          const roleOrder = ['pi', 'postdoc', 'graduate', 'staff', 'undergraduate'];
          for (const role of roleOrder) {
            const members = team.filter(m => m.role === role).sort((a, b) => a.order - b.order);
            if (members.length === 0) continue;
            sections.push(`### ${roleLabels[role] || role}`);
            for (const m of members) {
              let line = `- ${m.name}`;
              if (m.title) line += ` (${m.title})`;
              sections.push(line);
            }
            sections.push('');
          }

          // Software
          const softwareContent = readFileSync(join(contentDir, 'software.yaml'), 'utf-8');
          const software = yaml.load(softwareContent);
          sections.push(`## Software`);
          sections.push('');
          for (const item of software.sort((a, b) => a.order - b.order)) {
            sections.push(`- **${item.name}**: ${item.description}. ${item.url}`);
          }
          sections.push('');

          // Funding
          const fundingContent = readFileSync(join(contentDir, 'funding.yaml'), 'utf-8');
          const funding = yaml.load(fundingContent);
          sections.push(`## Funding`);
          sections.push('');
          for (const item of funding) {
            let line = `- ${item.agency} — ${item.name} (${item.role})`;
            if (item.amount) line += ` ${item.amount}`;
            if (item.years) line += ` (${item.years})`;
            sections.push(line);
          }
          sections.push('');

          // News (top 20)
          const newsContent = readFileSync(join(contentDir, 'news.yaml'), 'utf-8');
          const news = yaml.load(newsContent);
          const sorted = news.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          sections.push(`## Recent News (Latest 20)`);
          sections.push('');
          for (const item of sorted.slice(0, 20)) {
            sections.push(`- ${item.date}: ${item.text}`);
          }
          sections.push('');

          // Contact & Social
          sections.push(`## Contact & Social`);
          sections.push('');
          sections.push(`- Email: sm7683@nyu.edu`);
          sections.push(`- Office: Department of Physics, 726 Broadway, New York, NY 10013`);
          sections.push(`- Web: https://martinianilab.org`);
          sections.push(`- Google Scholar: ${geo.social.scholar}`);
          sections.push(`- ORCID: ${geo.social.orcid}`);
          sections.push(`- GitHub: ${geo.social.github}`);
          sections.push(`- LinkedIn: ${geo.social.linkedin}`);
          sections.push(`- Twitter/X: ${geo.social.twitter}`);
          sections.push(`- Bluesky: ${geo.social.bluesky}`);
          sections.push(`- ResearchGate: ${geo.social.researchgate}`);
          sections.push(`- NYU Faculty Page: ${geo.social.nyu}`);
          sections.push('');

          const output = sections.join('\n');
          writeFileSync(join(rootDir, 'public/llms-full.txt'), output, 'utf-8');
          logger.info(`llms-full.txt generated (${output.length} bytes)`);
        } catch (err) {
          logger.error(`Failed to generate llms-full.txt: ${err.message}`);
        }
      },
    },
  };
}
