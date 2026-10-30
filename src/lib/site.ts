import { getEntry, getCollection } from 'astro:content';
import substack from '../data/substack.json';

export interface SubstackPost {
  title: string;
  description: string;
  url: string;
  pubDate: string | null;
  slug: string;
  cover: string | null;
  readingMinutes: number;
  html: string;
}

export function getSubstackPosts(): SubstackPost[] {
  return [...(substack.posts as SubstackPost[])].sort(
    (a, b) => new Date(b.pubDate ?? 0).valueOf() - new Date(a.pubDate ?? 0).valueOf(),
  );
}

export function formatPostDate(iso: string | null, style: 'long' | 'short' = 'long'): string {
  if (!iso) return '';
  const d = new Date(iso);
  return style === 'long'
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const METRIC = /(~?\d[\d.,]*\s?(?:×|%|\+|M\+|K)?(?:\s?(?:hours?|minutes?|ms|services|repositories))?|sub-\d+ms|zero (?:downtime|data loss))/g;

/** Split text into plain and metric segments so numbers can be emphasised without set:html. */
export function emphasizeMetrics(text: string): { text: string; metric: boolean }[] {
  return text
    .split(METRIC)
    .filter(Boolean)
    .map((part) => ({ text: part, metric: new RegExp(`^${METRIC.source}$`).test(part) }));
}

export async function getProfile() {
  const entry = await getEntry('profile', 'site');
  if (!entry) throw new Error('profile/site.yaml missing');
  return entry.data;
}

export async function getAchievements() {
  const entry = await getEntry('achievements', 'site');
  if (!entry) throw new Error('achievements/site.yaml missing');
  return entry.data;
}

export async function getSkillsRings() {
  const entry = await getEntry('skillsRings', 'site');
  if (!entry) throw new Error('skillsRings/site.yaml missing');
  return entry.data;
}

export async function getExperienceSorted() {
  const items = await getCollection('experience');
  return items.sort((a, b) => a.data.order - b.data.order);
}

export async function getProjectsSorted() {
  const items = await getCollection('projects');
  return items.sort((a, b) => a.data.order - b.data.order);
}

export async function getBlogSorted() {
  const items = await getCollection('blog');
  return items.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function formatMonthRange(start: string, end?: string, current?: boolean): string {
  const fmt = (ym: string) => {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };
  const a = fmt(start);
  if (current) return `${a} – Present`;
  if (end) return `${a} – ${fmt(end)}`;
  return a;
}
