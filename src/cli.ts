import { parseFromUrl } from '.';

export const run = (url: string) => {
  console.log(url);
  parseFromUrl(url, p => {
    console.log(`${p.url} - ${p.lastModified}`);
    return true;
  })
    .then(r => console.log('SUCCESS', r))
    .catch(err => console.log('ERROR', err));
};

run(process.argv[2]);
