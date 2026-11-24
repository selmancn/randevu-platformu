const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const formatMoney = (cents: number) => money.format(cents / 100);
