import { batch, computed, effect, Signal } from '@preact/signals';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import { levenshtein } from 'wuzzy';

import { SortBy, sorters, SortOrder } from '~client/signals/Options/sort';
import type { AudiobookJSON } from '~db/models/Audiobook';

import { user } from '../User';

import { Read, Size } from './enums';

export interface OptionValues {
  books: AudiobookJSON[] | undefined;
  error: string | undefined;
  filter: string;
  page: number;
  pages: number;
  perPage: number;
  read: Read;
  selectedBook: AudiobookJSON | undefined;
  size: Size;
  sortBy: SortBy;
  sortOrder: SortOrder;
}

export type Options = OptionValues & {
  changeFilter: Dispatch<StateUpdater<string>>;
  changePage: Dispatch<StateUpdater<number>>;
  changePerPage: Dispatch<StateUpdater<number>>;
  changeRead: Dispatch<StateUpdater<Read>>;
  changeSize: Dispatch<StateUpdater<Size>>;
  changeSortBy: Dispatch<StateUpdater<SortBy>>;
  changeSortOrder: Dispatch<StateUpdater<SortOrder>>;
  selectBook: (id: string) => void;
  unselectBook: () => void;
  updateBook: (book: AudiobookJSON) => void;

  refresh: () => void;
};

export const refreshToken = new Signal(0);
export const refresh = () => {
  refreshToken.value = Date.now();
};

export const rawBooks = new Signal<AudiobookJSON[] | undefined>();
export const error = new Signal<string | undefined>();
export const search = new Signal<string>('');
export const page = new Signal<number>(0);
export const pages = new Signal<number>(1);
export const perPage = new Signal<number>(50);
export const read = new Signal<Read>(Read.All);
export const size = new Signal<Size>(Size.Medium);
export const sortBy = new Signal<SortBy>(SortBy.Author);
export const sortOrder = new Signal<SortOrder>(SortOrder.Ascending);
export const selectedBookId = new Signal<string | undefined>();

export const updateBook = (book: Partial<AudiobookJSON>) => {
  rawBooks.value = rawBooks.peek()?.map((b) => (b.id === book.id ? { ...b, ...book } : b));
};

// eslint-disable-next-line consistent-return
export const sizeColumns = computed(() => {
  switch (size.value) {
    case Size.Small:
      return 4;
    case Size.Medium:
      return 3;
    case Size.Large:
      return 2;
    case Size.XLarge:
      return 1;
  }
});

effect(() => {
  if (sortBy.value === SortBy.DateAdded) sortOrder.value = SortOrder.Descending;
  else sortOrder.value = SortOrder.Ascending;
});

effect(() => {
  if (page.value > pages.value) page.value = pages.value - 1;
});

export const selectedBook = computed(() => {
  if (!selectedBookId.value) return undefined;

  return rawBooks.value?.find(({ id }) => id === selectedBookId.value);
});

const filteredBooks = computed(() => {
  const lowerFilter = search.value.trim().toLocaleLowerCase();

  if (!rawBooks.value) return undefined;

  const readBooks =
    read.value === Read.All
      ? rawBooks.value
      : rawBooks.value.filter(
          ({ UserAudiobooks }) => UserAudiobooks?.some(({ read: r }) => r) === (read.value === Read.Read),
        );

  if (!lowerFilter) return readBooks;

  const exactMatches = readBooks.filter(
    (book) =>
      book.title.toLocaleLowerCase().includes(lowerFilter) ||
      [...(book.Authors || []), ...(book.Narrators || [])].some(({ firstName = '', lastName }) =>
        `${firstName} ${lastName}`.trim().toLocaleLowerCase().includes(lowerFilter),
      ),
  );

  if (exactMatches.length > 0) return exactMatches;

  let fuzzyBooks: AudiobookJSON[] = [];

  let threshold = 0.5;
  do {
    const thr = threshold;
    fuzzyBooks = readBooks.filter(
      (book) =>
        levenshtein(book.title, lowerFilter) > thr ||
        [...(book.Authors || []), ...(book.Narrators || [])].some(
          ({ firstName = '', lastName }) => levenshtein(`${firstName} ${lastName}`.trim(), lowerFilter) > thr,
        ),
    );
    threshold += 0.05;
  } while (fuzzyBooks.length > Math.max(2, Math.min(rawBooks.value.length / 4, 20)));

  return fuzzyBooks;
});

const sortedBooks = computed(() => {
  if (!filteredBooks.value) return null;

  const sorted = [...filteredBooks.value].sort(sorters[sortBy.value]);
  if (sortOrder.value === SortOrder.Descending) sorted.reverse();
  return sorted;
});

const paginatedBooks = computed(() => {
  const start = Math.min(sortedBooks.value?.length || 0, perPage.value * page.value);
  const end = Math.min(sortedBooks.value?.length || 0, start + perPage.value);
  return sortedBooks.value?.slice(start, end);
});

export const books = paginatedBooks;

effect(() => {
  // eslint-disable-next-line no-unused-expressions
  refreshToken.value;

  fetch('/books', { headers: { 'x-audiobook-catalog-user': user.value?.id || '' } })
    .then((resp) => Promise.all([resp.ok, resp.json() as Promise<AudiobookJSON<unknown>[]>]))
    .then(([ok, bks]) => {
      if (!ok) throw bks;

      batch(() => {
        rawBooks.value = bks;
        pages.value = Math.ceil(bks.length / perPage.peek());
      });
    })
    .catch((err) => {
      batch(() => {
        error.value = (err as Error).message;
        pages.value = 1;
      });
    });
});
