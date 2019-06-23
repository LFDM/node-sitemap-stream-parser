import * as fs from 'fs';
import * as path from 'path';
import { parseSitemapFromString } from '..';

const BASE = __dirname;

const readFile = (p: string) => fs.readFileSync(p).toString();

const run = () => {
  parseSitemapFromString(
    'http://example.com',
    readFile(path.join(BASE, 'sitemap.xml'))
  ).then(results => {
    console.log(results);
  });
};

run();
