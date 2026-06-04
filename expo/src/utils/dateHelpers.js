export const isToday = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
};

export const isThisWeek = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
};

export const isThisMonth = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

export const filterByPeriod = (items, period, dateField) => {
  const key = dateField || 'completedAt';
  return items.filter(item => {
    const d = item[key];
    if (period === 'Day') return isToday(d);
    if (period === 'Week') return isThisWeek(d);
    if (period === 'Month') return isThisMonth(d);
    return true;
  });
};

export const formatDuration = (seconds) => {
  if (!seconds) return '0 min';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return h + 'h ' + rm + 'min';
  }
  return m + ' min';
};
