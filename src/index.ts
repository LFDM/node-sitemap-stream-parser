import * as got_ from 'got';
import * as sax from 'sax';
import { pipeline, Readable, Stream } from 'stream';
import * as urlParser from 'url';
import { IOptions, IPage } from './types';

type SitemapIndex = { [url: string]: boolean };
type PageCallback = (page: IPage) => boolean;

const got = got_.extend({
  headers: {
    'user-agent':
      process.env.SITEMAP_PARSER_USER_AGENT || 'node-sitemap-stream-parser'
  }
});

const toStreamFromString = (str: string) => {
  const stream = new Stream.Readable();
  stream.push(str);
  stream.push(null);
  return stream;
};

const toStreamFromUrl = (url: string) => {
  return got.stream(url);
};

const emptyPage = (baseUrl: string): IPage => ({
  url: '',
  lastModified: '',
  sitemapUrl: baseUrl
});

const withPageCollector = (
  fn: (onPage: PageCallback) => Promise<any>
): Promise<IPage[]> => {
  const pages: IPage[] = [];
  return fn(page => {
    pages.push(page);
    return true;
  }).then(() => pages);
};

export const parseFromUrl = (
  url: string,
  onPage: PageCallback,
  options: Partial<IOptions> = {},
  sitemapIndex: SitemapIndex = {}
) => {
  return _parse(url, toStreamFromUrl(url), options, sitemapIndex, onPage);
};

export const parseFromUrls = (
  urls: string[],
  onPage: PageCallback,
  options: Partial<IOptions> = {},
  sitemapIndex: SitemapIndex = {}
) => {
  return Promise.all(
    urls.map(url => parseFromUrl(url, onPage, options, sitemapIndex))
  );
};

export const parseFromString = (
  baseUrl: string,
  xml: string,
  onPage: PageCallback,
  options: Partial<IOptions> = {}
) => {
  return _parse(baseUrl, toStreamFromString(xml), options, {}, onPage);
};

export const parse = (
  baseUrl: string,
  xmlStream: Readable,
  onPage: PageCallback,
  options: Partial<IOptions> = {}
) => {
  return _parse(baseUrl, xmlStream, options, {}, onPage);
};

export const collectFromUrl = (
  url: string,
  options: Partial<IOptions> = {},
  sitemapIndex: SitemapIndex = {}
) => {
  return withPageCollector(onPage =>
    parseFromUrl(url, onPage, options, sitemapIndex)
  );
};

export const collectFromUrls = (
  urls: string[],
  options: Partial<IOptions> = {},
  sitemapIndex: SitemapIndex = {}
) => {
  return withPageCollector(onPage =>
    parseFromUrls(urls, onPage, options, sitemapIndex)
  );
};

export const collectFromString = (
  baseUrl: string,
  xml: string,
  options: Partial<IOptions> = {}
) => {
  return withPageCollector(onPage =>
    parseFromString(baseUrl, xml, onPage, options)
  );
};

export const collect = (
  baseUrl: string,
  xmlStream: Readable,
  options: Partial<IOptions> = {}
) => {
  return withPageCollector(onPage =>
    parse(baseUrl, xmlStream, onPage, options)
  );
};

export const collectSitemapsFromRobotsUrl = (
  url: string
): Promise<string[]> => {
  return got
    .get(url)
    .then(r => collectSitemapsFromRobots(r.body))
    .catch(() => []);
};

export const collectSitemapsFromRobots = (robots: string): string[] => {
  const matches: string[] = [];
  robots.replace(/^Sitemap:\s?([^\s]+)$/gim, (m, p1) => {
    matches.push(p1);
    return m;
  });
  return matches;
};

const _parse = (
  baseUrl: string,
  xmlStream: Readable,
  options: Partial<IOptions>,
  visitedSitemaps: SitemapIndex,
  onPage: PageCallback
): Promise<void> => {
  const opts: IOptions = {
    checkSitemap: () => true,
    checkUrl: () => true,
    onError: err => Promise.reject(err),
    ...options
  };

  if (visitedSitemaps[baseUrl] || !opts.checkSitemap(baseUrl)) {
    return Promise.resolve();
  }

  visitedSitemaps[baseUrl] = true;

  return new Promise((resolve, reject) => {
    const state = {
      url: false,
      loc: false,
      lastmod: false,
      isSitemap: false,
      isSitemapIndex: false,

      currentPage: emptyPage(baseUrl),
      sitemaps: [] as string[],

      manuallyEnded: false
    };

    const parserStream = sax.createStream(false, {
      trim: true,
      normalize: true,
      lowercase: true
    });

    parserStream.on('opentag', node => {
      if (state.manuallyEnded) {
        return;
      }

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
      if (state.manuallyEnded) {
        return;
      }

      if (tag === 'url') {
        state.url = false;
        if (opts.checkUrl(state.currentPage.url)) {
          const continueStreaming = onPage(state.currentPage);
          if (!continueStreaming) {
            state.manuallyEnded = true;
            // parserStream.end(); // doesn't actually end - this is broken!
            return;
          }
        }
        state.currentPage = emptyPage(baseUrl);
      }

      if (tag === 'loc') {
        state.loc = false;
      }
      if (tag === 'lastmod') {
        state.lastmod = false;
      }
    });

    parserStream.on('text', t => {
      if (state.manuallyEnded) {
        return;
      }

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

    parserStream.on('end', () => {
      if (state.isSitemapIndex) {
        parseFromUrls(
          state.sitemaps,
          onPage,
          options,
          visitedSitemaps
        ).then(() => resolve());
        return;
      }

      resolve();
    });

    pipeline(xmlStream, parserStream, err => {
      opts.onError(err).then(resolve, reject);
    });
  });
};
