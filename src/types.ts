export interface IPage {
  url: string;
  lastModified: string;
  sitemapUrl: string;
}

export interface IOptions {
  checkSitemap: (url: string) => boolean;
  checkUrl: (url: string) => boolean;
  ignoreStreamErrors: boolean;
}
