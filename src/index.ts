import request from 'request';
import sax from 'sax';
import { Stream } from 'stream';
import url from 'url';
import { IPage } from './types';

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

export const parseSitemapFromUrl = (url: string): Promise<IPage[]> => {
  return new Promise((resolve, reject) => {
    const stream = request.get(url, { gzip: true });
    stream.on('error', reject);
    return parseSitemap(url, stream).then(resolve);
  });
};

export const parseSitemapsFromUrls = (urls: string[]) => {
  url.resolve;
  return Promise.all(urls.map(parseSitemapFromUrl)).then(flatten);
};

export const parseSitemapFromString = (baseUrl: string, xml: string) => {
  return parseSitemap(baseUrl, toReadableStream(xml));
};

export const parseSitemap = (
  baseUrl: string,
  xmlStream: Stream
): Promise<IPage[]> => {
  return new Promise((resolve, reject) => {
    const parserStream = sax.createStream(false, {
      trim: true,
      normalize: true,
      lowercase: true
    });
  });
};
