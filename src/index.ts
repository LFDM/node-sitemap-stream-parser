import { IPage } from './types';

const flatten = <T>(lists: T[][]): T[] =>
  lists.reduce((r, l) => r.concat(l), []);

export const parseSitemap = (url: string): Promise<IPage[]> => {
  return Promise.resolve([]);
};

export const parseSitemaps = (urls: string[]): Promise<IPage[]> => {
  return Promise.all(urls.map(parseSitemap)).then(flatten);
};
