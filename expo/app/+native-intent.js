export function redirectSystemPath({ path, initial }) {
  if (path.startsWith('zownhq://')) {
    return path.replace('zownhq://', '/');
  }
  return path;
}
