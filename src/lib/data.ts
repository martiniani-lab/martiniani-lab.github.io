import yaml from 'js-yaml';
import { readFileSync } from 'node:fs';

export interface TeamMember {
  name: string;
  role: 'pi' | 'postdoc' | 'graduate' | 'staff' | 'undergraduate';
  image: string;
  title?: string;
  bio?: string;
  links?: Record<string, string>;
  order: number;
}

export interface NewsItem {
  date: string;
  text: string;
  link?: string;
}

export interface Highlight {
  title: string;
  subtitle: string;
  image: string;
  link: string;
  color?: string;
}

export interface SoftwareItem {
  name: string;
  description: string;
  image?: string;
  url: string;
  github?: string;
  featured?: boolean;
  order: number;
}

export interface GalleryItem {
  title: string;
  youtubeId: string;
  description?: string;
}

export interface PressItem {
  category: 'cover' | 'editorial' | 'podcast' | 'newspaper';
  title: string;
  image?: string;
  url: string;
  source: string;
  date?: string;
  description?: string;
  extra_url?: string;
  extra_label?: string;
}

export interface AlumniMember {
  category: 'postdoc' | 'graduate' | 'undergraduate' | 'visitor';
  name: string;
  degree?: string;
  year?: number;
  currentPosition?: string;
  linkedin?: string;
}

export interface FundingItem {
  agency: string;
  name: string;
  image?: string;
  amount?: string;
  role?: string;
  years?: string;
  description?: string;
  url?: string;
  awardNumber?: string;
  announcementOnly?: boolean;
}

export interface Course {
  name: string;
  code?: string;
  description?: string;
}

export interface TeachingItem {
  institution: string;
  years: string;
  courses: Course[];
}

function loadYaml<T>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf-8');
  const data = yaml.load(content);
  if (!Array.isArray(data)) return [];
  return data as T[];
}

export function loadTeam(filePath: string): TeamMember[] {
  return loadYaml<TeamMember>(filePath);
}

export function loadNews(filePath: string): NewsItem[] {
  const items = loadYaml<NewsItem>(filePath);
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function loadHighlights(filePath: string): Highlight[] {
  return loadYaml<Highlight>(filePath);
}

export function loadSoftware(filePath: string): SoftwareItem[] {
  return loadYaml<SoftwareItem>(filePath).sort((a, b) => a.order - b.order);
}

export function loadGallery(filePath: string): GalleryItem[] {
  return loadYaml<GalleryItem>(filePath);
}

export function loadPress(filePath: string): PressItem[] {
  return loadYaml<PressItem>(filePath);
}

export function loadAlumni(filePath: string): AlumniMember[] {
  return loadYaml<AlumniMember>(filePath);
}

export function loadFunding(filePath: string): FundingItem[] {
  return loadYaml<FundingItem>(filePath);
}

export function loadTeaching(filePath: string): TeachingItem[] {
  return loadYaml<TeachingItem>(filePath);
}

export function getTeamByRole(team: TeamMember[]): Record<string, TeamMember[]> {
  const groups: Record<string, TeamMember[]> = {};
  const roleOrder = ['pi', 'postdoc', 'graduate', 'staff', 'undergraduate'];
  for (const role of roleOrder) {
    const members = team.filter(m => m.role === role).sort((a, b) => a.order - b.order);
    if (members.length > 0) groups[role] = members;
  }
  return groups;
}

export function getLatestNews(news: NewsItem[], count: number): NewsItem[] {
  return news.slice(0, count);
}

export function getPressByCategory(press: PressItem[]): Record<string, PressItem[]> {
  const groups: Record<string, PressItem[]> = {};
  for (const item of press) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}

export function getAlumniByCategory(alumni: AlumniMember[]): Record<string, AlumniMember[]> {
  const groups: Record<string, AlumniMember[]> = {};
  for (const member of alumni) {
    if (!groups[member.category]) groups[member.category] = [];
    groups[member.category].push(member);
  }
  return groups;
}
