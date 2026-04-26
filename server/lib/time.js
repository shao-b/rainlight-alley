export function getLocalDateParts(date = new Date(), timeZone = 'Asia/Shanghai') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

export function diffLocalDays(fromDate, toDate, timeZone = 'Asia/Shanghai') {
  const from = getLocalDateParts(new Date(fromDate), timeZone);
  const to = getLocalDateParts(new Date(toDate), timeZone);
  const utcFrom = Date.UTC(from.year, from.month - 1, from.day);
  const utcTo = Date.UTC(to.year, to.month - 1, to.day);
  return Math.floor((utcTo - utcFrom) / 86400000);
}
