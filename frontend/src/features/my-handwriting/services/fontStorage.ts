import { openDB } from 'idb';

import { MY_HANDWRITING_STORAGE_KEY } from '../constants';

const DB_NAME = 'text-to-handwriting';
const STORE_NAME = 'generated-fonts';

const getFontDatabase = async () =>
  openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });

export const saveFont = async (buffer: ArrayBuffer): Promise<void> => {
  const database = await getFontDatabase();

  await database.put(STORE_NAME, buffer, MY_HANDWRITING_STORAGE_KEY);
};

export const loadFont = async (): Promise<ArrayBuffer | null> => {
  const database = await getFontDatabase();
  const value = await database.get(STORE_NAME, MY_HANDWRITING_STORAGE_KEY);

  return value ?? null;
};

export const deleteFont = async (): Promise<void> => {
  const database = await getFontDatabase();

  await database.delete(STORE_NAME, MY_HANDWRITING_STORAGE_KEY);
};

export const hasSavedFont = async (): Promise<boolean> => {
  const existingFont = await loadFont();

  return existingFont !== null && existingFont.byteLength > 0;
};
