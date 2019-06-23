import request from 'request';
import sax from 'sax';
import { Stream } from 'stream';
import urlParser from 'url';
import { IOptions, IPage } from './types';

type SitemapIndex = { [url: string]: boolean };
type PageCallback = (page: IPage) => void;

const toReadableStream = (str: string) => {
  const stream = new Stream.Readable();
  stream.push(str);
  stream.push(null);
  return stream;
};

const emptyPage = (baseUrl: string): IPage => ({
  url: '',
  lastModified: '',
  sitemapUrl: baseUrl
});

const withPageCollector = <T>(
  fn: (onPage: PageCallback) => Promise<T>
): Promise<IPage[]> => {
  const pages: IPage[] = [];
  return fn(page => pages.push(page)).then(() => pages);
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

export const parseFromUrl = (
  url: string,
  onPage: (page: IPage) => void,
  options: Partial<IOptions> = {},
  sitemapIndex: SitemapIndex = {}
) => {
  return new Promise((resolve, reject) => {
    const stream = request.get(url, { gzip: true });
    stream.on('error', reject);
    return _parse(url, stream, options, sitemapIndex, onPage).then(
      () => resolve
    );
  });
};

export const parseFromUrls = (
  urls: string[],
  onPage: (page: IPage) => void,
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
): Promise<void> => {
  return _parse(baseUrl, toReadableStream(xml), options, {}, onPage);
};

export const parse = (
  baseUrl: string,
  xmlStream: Stream,
  onPage: PageCallback,
  options: Partial<IOptions> = {}
): Promise<void> => {
  return _parse(baseUrl, xmlStream, options, {}, onPage);
};

export const collectFromUrl = (
  url: string,
  options: Partial<IOptions> = {},
  sitemapIndex: SitemapIndex = {}
): Promise<IPage[]> => {
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
  xmlStream: Stream,
  options: Partial<IOptions> = {}
): Promise<IPage[]> => {
  return withPageCollector(onPage =>
    parse(baseUrl, xmlStream, onPage, options)
  );
};

const _parse = (
  baseUrl: string,
  xmlStream: Stream,
  options: Partial<IOptions>,
  visitedSitemaps: SitemapIndex,
  onPage: (page: IPage) => void
): Promise<void> => {
  const opts: IOptions = {
    checkSitemap: () => true,
    checkUrl: () => true,
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
        if (opts.checkUrl(state.currentPage.url)) {
          onPage(state.currentPage);
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
      if (state.isSitemapIndex) {
        parseFromUrls(state.sitemaps, onPage, options, visitedSitemaps).then(
          () => resolve()
        );
        return;
      }

      resolve();
    });

    xmlStream.pipe(parserStream);
  });
};
