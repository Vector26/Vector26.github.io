/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    profile: import('astro:content').CollectionEntry<'profile'>['data'];
  }
}
