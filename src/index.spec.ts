import * as fs from 'fs';
import * as path from 'path';
import { parseSitemapFromString } from '.';

const BASE = path.join(__dirname, 'examples');
const readFile = (p: string) => fs.readFileSync(p).toString();

const sitemap = readFile(path.join(BASE, 'sitemap.xml'));

describe('parseSitemapsFromString', () => {
  it('runs', () => {
    return parseSitemapFromString('http//example.com', sitemap).then(pages => {
      console.log(pages);
      expect(true).toBe(true);
    });
  });
});
