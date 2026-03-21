import { parse } from 'bibtex-parse';
import { readFileSync } from 'node:fs';

export interface Publication {
  key: string;
  type: string;
  title: string;
  authors: string;
  journal: string;
  volume: string;
  pages: string;
  year: number;
  doi: string;
  url: string;
  arxiv: string;
  localPdf: string;
  note: string;
  sortkey: number;
  isPreprint: boolean;
}

function cleanLatex(str: string): string {
  if (!str) return '';
  return str
    .replace(/[{}]/g, '')
    .replace(/\\&/g, '&')
    .replace(/~/g, ' ')
    .replace(/\\\\/g, '')
    .replace(/\\textrm/g, '')
    .replace(/\\textit/g, '')
    .replace(/\\textbf/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface BibtexField {
  name: string;
  value: string;
}

interface BibtexEntry {
  itemtype: string;
  type?: string;
  key?: string;
  fields?: BibtexField[];
}

function getField(fields: BibtexField[], name: string): string {
  const field = fields.find(f => f.name === name);
  return field ? cleanLatex(field.value) : '';
}

export function parseBibtex(bibContent: string): Publication[] {
  const items = parse(bibContent) as BibtexEntry[];
  const publications: Publication[] = [];

  for (const item of items) {
    if (item.itemtype !== 'entry') continue;

    const fields = item.fields || [];
    const entryType = item.type || '';
    const journal = getField(fields, 'journal');
    const year = parseInt(getField(fields, 'year')) || 0;
    const arxiv = getField(fields, 'eprint') || getField(fields, 'arxiv');
    const isPreprint = entryType === 'unpublished' ||
      journal.toLowerCase().includes('arxiv') ||
      journal.toLowerCase().includes('biorxiv') ||
      (!journal && !!arxiv);

    publications.push({
      key: item.key || '',
      type: entryType,
      title: getField(fields, 'title'),
      authors: getField(fields, 'author'),
      journal,
      volume: getField(fields, 'volume'),
      pages: getField(fields, 'pages'),
      year,
      doi: getField(fields, 'doi'),
      url: getField(fields, 'url'),
      arxiv,
      localPdf: getField(fields, 'localfile'),
      note: getField(fields, 'note'),
      sortkey: parseInt(getField(fields, 'sortkey')) || 0,
      isPreprint,
    });
  }

  publications.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.sortkey - a.sortkey;
  });

  return publications;
}

export function loadPublications(bibPath: string): Publication[] {
  const content = readFileSync(bibPath, 'utf-8');
  return parseBibtex(content);
}

export function getPublished(pubs: Publication[]): Publication[] {
  return pubs.filter(p => !p.isPreprint);
}

export function getPreprints(pubs: Publication[]): Publication[] {
  return pubs.filter(p => p.isPreprint);
}

export function formatAuthors(authors: string, maxAuthors = 20): string {
  const parts = authors.split(' and ').map(a => a.trim());
  if (parts.length <= maxAuthors) return parts.join(', ');
  return parts.slice(0, maxAuthors).join(', ') + ', et al.';
}
