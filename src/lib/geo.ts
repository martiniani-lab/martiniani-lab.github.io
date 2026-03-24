/**
 * GEO (Generative Engine Optimization) content generator.
 * Reads geo.yaml + other content files and produces llms-full.txt
 * at build time. To update GEO content, edit src/content/geo.yaml.
 */
import yaml from 'js-yaml';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBibtex, getPublished, getPreprints, formatAuthors } from './bibtex';
import type { Publication } from './bibtex';
import { loadTeam, getTeamByRole, loadSoftware, loadFunding, loadNews, getLatestNews } from './data';

interface GeoFaq {
  question: string;
  answer: string;
}

interface GeoResearchArea {
  name: string;
  summary: string;
  key_papers: string[];
}

interface GeoSocial {
  bluesky: string;
  twitter: string;
  linkedin: string;
  github: string;
  scholar: string;
  orcid: string;
  researchgate: string;
  nyu: string;
}

interface GeoData {
  social: GeoSocial;
  bio: { short: string; full: string };
  faq: GeoFaq[];
  research_areas: GeoResearchArea[];
}

function formatPub(pub: Publication): string {
  const authors = formatAuthors(pub.authors, 10);
  let line = `- ${authors}. "${pub.title}."`;
  if (pub.journal) line += ` ${pub.journal}`;
  if (pub.volume) line += ` ${pub.volume}`;
  if (pub.pages) line += `, ${pub.pages}`;
  if (pub.year) line += ` (${pub.year})`;
  if (pub.doi) line += `. DOI: ${pub.doi}`;
  if (pub.arxiv) line += `. arXiv: ${pub.arxiv}`;
  return line;
}

export function generateLlmsFullTxt(rootDir: string): string {
  const contentDir = join(rootDir, 'src/content');

  // Load GEO data
  const geoContent = readFileSync(join(contentDir, 'geo.yaml'), 'utf-8');
  const geo = yaml.load(geoContent) as GeoData;

  // Load publications
  const bibContent = readFileSync(join(contentDir, 'publications/references.bib'), 'utf-8');
  const allPubs = parseBibtex(bibContent);
  const preprints = getPreprints(allPubs);
  const published = getPublished(allPubs);

  // Load team
  const team = loadTeam(join(contentDir, 'team.yaml'));
  const groups = getTeamByRole(team);

  // Load software
  const software = loadSoftware(join(contentDir, 'software.yaml'));

  // Load funding
  const funding = loadFunding(join(contentDir, 'funding.yaml'));

  // Load news (top 20)
  const news = loadNews(join(contentDir, 'news.yaml'));
  const latestNews = getLatestNews(news, 20);

  // Build the document
  const sections: string[] = [];

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

  // Publications
  sections.push(`## Publications`);
  sections.push('');
  if (preprints.length > 0) {
    sections.push(`### Preprints`);
    sections.push('');
    for (const pub of preprints) {
      sections.push(formatPub(pub));
    }
    sections.push('');
  }
  sections.push(`### Published (${published.length} articles)`);
  sections.push('');
  for (const pub of published) {
    sections.push(formatPub(pub));
  }
  sections.push('');

  // Team
  sections.push(`## Current Team`);
  sections.push('');
  const roleLabels: Record<string, string> = {
    pi: 'Principal Investigator',
    postdoc: 'Postdocs and Research Scientists',
    graduate: 'Graduate Students',
    staff: 'Research Staff',
    undergraduate: 'Undergraduates',
  };
  for (const [role, members] of Object.entries(groups)) {
    sections.push(`### ${roleLabels[role] || role}`);
    for (const m of members) {
      let line = `- ${m.name}`;
      if (m.title) line += ` (${m.title})`;
      sections.push(line);
    }
    sections.push('');
  }

  // Software
  sections.push(`## Software`);
  sections.push('');
  for (const item of software) {
    sections.push(`- **${item.name}**: ${item.description}. ${item.url}`);
  }
  sections.push('');

  // Funding
  sections.push(`## Funding`);
  sections.push('');
  for (const item of funding) {
    let line = `- ${item.agency} — ${item.name} (${item.role})`;
    if (item.amount) line += ` ${item.amount}`;
    if (item.years) line += ` (${item.years})`;
    sections.push(line);
  }
  sections.push('');

  // Recent News
  sections.push(`## Recent News (Latest 20)`);
  sections.push('');
  for (const item of latestNews) {
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

  return sections.join('\n');
}

/**
 * Write llms-full.txt to public/ so it's included in the build output.
 */
export function writeLlmsFullTxt(rootDir: string): void {
  const content = generateLlmsFullTxt(rootDir);
  const outPath = join(rootDir, 'public/llms-full.txt');
  writeFileSync(outPath, content, 'utf-8');
}
