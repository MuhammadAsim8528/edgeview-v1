import fs from 'node:fs';
const copy = fs.copyFileSync;
fs.copyFileSync = (source, destination, ...options) => {
  if (String(destination).endsWith('config.json')) throw new Error('Controlled backup copy failure');
  return copy(source, destination, ...options);
};
