import { toSkipTake } from './pagination.js';

describe('toSkipTake', () => {
  it('skips nothing when the first page is requested', () => {
    expect(toSkipTake({ page: 1, pageSize: 20 })).toEqual({
      skip: 0,
      take: 20,
    });
  });

  it('skips every previous page when a later page is requested', () => {
    expect(toSkipTake({ page: 3, pageSize: 5 })).toEqual({ skip: 10, take: 5 });
  });
});
