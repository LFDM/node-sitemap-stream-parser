import { parseFromUrl } from '.';

export const run = (url: string) => {
  console.log(url);
  parseFromUrl(url, p => {
    console.log(`${p.url} - ${p.lastModified}`);
    return true;
  }).catch(err => console.log(err));
};

run(process.argv[2]);
