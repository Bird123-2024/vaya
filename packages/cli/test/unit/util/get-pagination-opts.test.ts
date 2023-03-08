import { getPaginationOpts } from '@vercel-internals/utils';
import { getArgs } from '@vercel-internals/utils';

describe('getOpts', () => {
  it('should throw an error if next not a number', async () => {
    const args = getArgs([`--next=oops`], { '--next': Number });
    expect(() => {
      getPaginationOpts(args);
    }).toThrowError();
  });

  it('should throw an error if limit not valid', async () => {
    for (let limit of ['abc', '101', '1.1', '-1']) {
      const args = getArgs([`--limit=${limit}`], { '--limit': Number });
      expect(() => {
        getPaginationOpts(args);
      }).toThrowError();
    }
  });
});
