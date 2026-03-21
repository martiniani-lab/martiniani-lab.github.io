import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadTeam, loadNews, loadHighlights, loadFunding, loadAlumni, loadTeaching,
  getTeamByRole, getLatestNews, getAlumniByCategory,
} from '../data';

const tmpDir = join(import.meta.dirname, '__tmp__');

function writeTmp(name: string, content: string): string {
  mkdirSync(tmpDir, { recursive: true });
  const p = join(tmpDir, name);
  writeFileSync(p, content);
  return p;
}

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadTeam', () => {
  it('loads team members from YAML', () => {
    const path = writeTmp('team.yaml', `
- name: "Stefano Martiniani"
  role: pi
  image: stefano.jpg
  order: 1
- name: "Mathias Casiulis"
  role: postdoc
  image: mathias.jpg
  order: 1
- name: "Satyam Anand"
  role: graduate
  image: satyam.jpg
  order: 1
`);
    const team = loadTeam(path);
    expect(team).toHaveLength(3);
    expect(team[0].name).toBe('Stefano Martiniani');
    expect(team[0].role).toBe('pi');
  });
});

describe('getTeamByRole', () => {
  it('groups and orders by role', () => {
    const team = [
      { name: 'A', role: 'graduate' as const, image: '', order: 2 },
      { name: 'B', role: 'pi' as const, image: '', order: 1 },
      { name: 'C', role: 'graduate' as const, image: '', order: 1 },
      { name: 'D', role: 'postdoc' as const, image: '', order: 1 },
    ];
    const groups = getTeamByRole(team);
    const keys = Object.keys(groups);
    expect(keys).toEqual(['pi', 'postdoc', 'graduate']);
    expect(groups['graduate'][0].name).toBe('C'); // order 1 before order 2
    expect(groups['graduate'][1].name).toBe('A');
  });
});

describe('loadNews', () => {
  it('loads and sorts by date descending', () => {
    const path = writeTmp('news.yaml', `
- date: "2024-01-15"
  text: "Old news"
- date: "2025-03-01"
  text: "New news"
- date: "2024-06-10"
  text: "Mid news"
`);
    const news = loadNews(path);
    expect(news).toHaveLength(3);
    expect(news[0].text).toBe('New news');
    expect(news[2].text).toBe('Old news');
  });
});

describe('getLatestNews', () => {
  it('returns only the first N items', () => {
    const news = [
      { date: '2025-03-01', text: 'A' },
      { date: '2025-02-01', text: 'B' },
      { date: '2025-01-01', text: 'C' },
    ];
    expect(getLatestNews(news, 2)).toHaveLength(2);
    expect(getLatestNews(news, 2)[0].text).toBe('A');
  });
});

describe('loadHighlights', () => {
  it('loads highlights from YAML', () => {
    const path = writeTmp('highlights.yaml', `
- title: "AI for Materials"
  subtitle: "OMatG"
  image: research/omatg.png
  link: https://example.com
`);
    const highlights = loadHighlights(path);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].title).toBe('AI for Materials');
  });
});

describe('loadFunding', () => {
  it('loads funding entries', () => {
    const path = writeTmp('funding.yaml', `
- agency: NSF
  name: "FERMat"
  amount: "$4.5M"
  role: "Lead PI"
  years: "2023-2028"
`);
    const funding = loadFunding(path);
    expect(funding).toHaveLength(1);
    expect(funding[0].agency).toBe('NSF');
    expect(funding[0].amount).toBe('$4.5M');
  });
});

describe('loadAlumni / getAlumniByCategory', () => {
  it('groups alumni by category', () => {
    const path = writeTmp('alumni.yaml', `
- category: postdoc
  name: "Aaron Shih"
  degree: "Ph.D."
  year: 2025
- category: graduate
  name: "Some Student"
  year: 2023
- category: postdoc
  name: "Another Postdoc"
  year: 2024
`);
    const alumni = loadAlumni(path);
    const groups = getAlumniByCategory(alumni);
    expect(groups['postdoc']).toHaveLength(2);
    expect(groups['graduate']).toHaveLength(1);
  });
});

describe('loadTeaching', () => {
  it('loads teaching entries with nested courses', () => {
    const path = writeTmp('teaching.yaml', `
- institution: "New York University"
  years: "2022-present"
  courses:
    - name: "Physics of Neural Systems"
      code: "PHYS-GA 2071"
    - name: "Statistical Mechanics"
      code: "PHYS-GA 2000"
`);
    const teaching = loadTeaching(path);
    expect(teaching).toHaveLength(1);
    expect(teaching[0].courses).toHaveLength(2);
    expect(teaching[0].courses[0].name).toBe('Physics of Neural Systems');
  });
});
