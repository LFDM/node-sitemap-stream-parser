import request from 'request';
import sax from 'sax';
import { Stream } from 'stream';
import urlParser from 'url';
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

const emptyPage = (baseUrl: string): IPage => ({
  url: '',
  lastModified: '',
  src: baseUrl
});

export const parseSitemap = (
  baseUrl: string,
  xmlStream: Stream,
  visitedSitemaps: SitemapIndex
): Promise<IPage[]> => {
  visitedSitemaps[baseUrl] = true;

  return new Promise((resolve, reject) => {
    const state = {
      url: false,
      loc: false,
      lastmod: false,
      isSitemap: false,
      isSitemapIndex: false,

      currentPage: emptyPage(baseUrl),
      pages: [] as IPage[],

      sitemaps: [] as string[]
    };

    const parserStream = sax.createStream(false, {
      trim: true,
      normalize: true,
      lowercase: true
    });

    parserStream.on('opentag', node => {
      if (node.name === 'url') {
        state.url = true;
      }

      if (node.name === 'loc') {
        state.loc = true;
      }
      if (node.name === 'lastmod') {
        state.lastmod = true;
      }
      if (node.name === 'urlset') {
        state.isSitemap = true;
      }
      if (node.name === 'sitemapindex') {
        state.isSitemapIndex = true;
      }
    });

    parserStream.on('closetag', tag => {
      if (tag === 'url') {
        state.url = false;
        state.pages.push(state.currentPage);
        state.currentPage = emptyPage(baseUrl);
      }

      if (tag === 'loc') {
        state.loc = false;
      }
      if (tag == 'lastmod') {
        state.lastmod = false;
      }
    });

    parserStream.on('text', t => {
      if (state.isSitemap) {
        if (state.url) {
          if (state.loc) {
            state.currentPage.url = urlParser.resolve(baseUrl, t);
          }
          if (state.lastmod) {
            state.currentPage.lastModified = t;
          }
        }
      }

      if (state.isSitemapIndex) {
        if (state.loc) {
          state.sitemaps.push(urlParser.resolve(baseUrl, t));
        }
      }
    });

    parserStream.on('error', reject);
    parserStream.on('end', () => {
      console.log('done'!);
      if (state.isSitemapIndex) {
        // iterate once more
        return;
      }

      resolve(state.pages);
    });

    xmlStream.pipe(parserStream);
  });
};
