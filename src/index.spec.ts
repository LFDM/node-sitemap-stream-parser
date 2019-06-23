import * as fs from 'fs';
import * as path from 'path';
import { collectFromString, collectSitemapsFromRobots } from '.';

const BASE = path.join(__dirname, 'examples');
const readFile = (p: string) => fs.readFileSync(p).toString();

const sitemap = readFile(path.join(BASE, 'sitemap.xml'));
const robots = readFile(path.join(BASE, 'robots.txt'));

describe('collectFromString', () => {
  it('works', () => {
    return collectFromString('http//example.com', sitemap).then(pages => {
      expect(pages).toHaveLength(2);

      const [p1, p2] = pages;
      expect(p1.url).toEqual(
        'https://notanomadblog.com/amalfi-coast-budget-tips/'
      );
      expect(p1.lastModified).toEqual('2019-06-21T21:14:47+02:00');
      expect(p1.sitemapUrl).toEqual('http//example.com');

      expect(p2.url).toEqual(
        'https://notanomadblog.com/best-day-trips-from-cape-town/'
      );
      expect(p2.lastModified).toEqual('2019-06-22T10:36:55+02:00');
      expect(p2.sitemapUrl).toEqual('http//example.com');
    });
  });
});

describe('collectSitemapsFromRobots', () => {
  const actual = collectSitemapsFromRobots(robots);
  const expected = [
    'http://www.example.com/sitemap1.xml',
    'http://www.example.com/sitemap2.xml'
  ];
  expect(actual).toEqual(expected);
});
