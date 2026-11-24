export const appointmentStatus = {
  requested: 'Onay bekliyor',
  confirmed: 'Onaylandı',
  cancelled: 'İptal edildi',
  completed: 'Tamamlandı',
};

const format = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul',
});

export function appointmentTime(value: string) {
  return format.format(new Date(value));
}
