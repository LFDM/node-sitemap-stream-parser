export interface IPage {
  url: string;
  lastModified: string;
  sitemapUrl: string;
}

export interface IOptions {
  checkSitemap: (url: string) => boolean;
  checkUrl: (url: string) => boolean;
  // resolve promise to ignore error
  onError: (err: any, args: { url: string }) => Promise<void>;
  maxParallelSitemapsProcessed: number;
}
