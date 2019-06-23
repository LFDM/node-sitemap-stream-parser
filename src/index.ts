import request from 'request';
import sax from 'sax';
import { Stream } from 'stream';
import { IPage } from './types';

type SitemapIndex = { [url: string]: boolean };

const flatten = <T>(lists: T[][]): T[] =>
  lists.reduce((r, l) => r.concat(l), []);

const toReadableStream = (str: string) => {
  const stream = new Stream.Readable();
  stream.push(str);
  stream.push(null);
  return stream;
};

request.defaults({
  headers: {
    'user-agent': process.env.SITEMAP_PARSER_USER_AGENT || 'sitemap-parser'
  },
  agentOptions: {
    keepAlive: true
  },
  timeout: parseInt(process.env.SITEMAP_PARSER_TIMEOUT || '', 10) || 60000
});

export const parseSitemapFromUrl = (
  url: string,
  sitemapIndex: SitemapIndex = {}
): Promise<IPage[]> => {
  return new Promise((resolve, reject) => {
    const stream = request.get(url, { gzip: true });
    stream.on('error', reject);
    return parseSitemap(url, stream, sitemapIndex).then(resolve);
  });
};

export const parseSitemapsFromUrls = (urls: string[]) => {
  const index: SitemapIndex = {};
  return Promise.all(urls.map(url => parseSitemapFromUrl(url, index))).then(
    flatten
  );
};

export const parseSitemapFromString = (baseUrl: string, xml: string) => {
  return parseSitemap(baseUrl, toReadableStream(xml), {});
};

export const parseSitemap = (
  baseUrl: string,
  xmlStream: Stream,
  visitedSitemaps: SitemapIndex
): Promise<IPage[]> => {
  visitedSitemaps[baseUrl] = true;

  return new Promise((resolve, reject) => {
    const parserStream = sax.createStream(false, {
      trim: true,
      normalize: true,
      lowercase: true
    });
  });
};
