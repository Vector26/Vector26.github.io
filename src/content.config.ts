import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const experience = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experience' }),
  schema: z.object({
    company: z.string(),
    title: z.string(),
    location: z.string().optional(),
    start: z.string(),
    end: z.string().optional(),
    current: z.boolean().optional(),
    order: z.number(),
    highlights: z.array(z.string()),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    year: z.number().optional(),
    tags: z.array(z.string()).default([]),
    url: z.string().optional(),
    repo: z.string().optional(),
    stars: z.number().optional(),
    order: z.number(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    canonical: z.string().url(),
    tags: z.array(z.string()).default([]),
  }),
});

const profile = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/profile' }),
  schema: z.object({
    name: z.string(),
    given: z.string(),
    family: z.string(),
    tagline: z.string(),
    about: z.string(),
    location: z.string(),
    email: z.string().email(),
    links: z.object({
      github: z.string().url(),
      linkedin: z.string().url(),
      substack: z.string().url(),
      instagram: z.string().url(),
      pinterest: z.string().url(),
      website: z.string().url(),
    }),
    chips: z.array(
      z.object({
        label: z.string(),
        hot: z.boolean().optional(),
        title: z.string().optional(),
      }),
    ),
  }),
});

const achievements = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/achievements' }),
  schema: z.object({
    awards: z.array(z.object({ title: z.string(), date: z.string(), detail: z.string().optional() })),
    leadership: z.array(z.object({ role: z.string(), org: z.string(), detail: z.string() })),
    education: z.object({
      school: z.string(),
      degree: z.string(),
      location: z.string(),
      graduated: z.string(),
      gpa: z.string().optional(),
    }),
  }),
});

const skillsRings = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/skillsRings' }),
  schema: z.object({
    rings: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        glyphs: z.string(),
        skills: z.array(z.string()),
      }),
    ),
  }),
});

export const collections = {
  experience,
  projects,
  blog,
  profile,
  achievements,
  skillsRings,
};
