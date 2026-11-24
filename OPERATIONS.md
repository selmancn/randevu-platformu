# PostgreSQL ve yayın işletimi

## Yerel süreçler

- `npm.cmd run db:local` PostgreSQL kümesini ilk kullanımda başlatır ve şemayı uygular. Küme açıkken şemayı yenilemek için `npm.cmd run db:local -- --migrate-only`.
- İlk yerel sürümden aktarım için eski uygulama süreci kapalıyken `npm.cmd run db:local -- --import-pglite`. Aktarım işletme ve hizmet kimliklerini korur. Aynı kimlikler yeniden eklenmez. Oturumlar taşınmaz.
- Uygulama rolü PostgreSQL süper kullanıcısı veya şema sahibi değildir. PostgreSQL yalnız yerel arayüzde dinler ve SCRAM kullanır. Kurulum kimlik dosyasını proje dışına paylaşma. Üretim kipi `APPOINTMENT_HTTPS=1` ile Secure çerezleri kullanır ve uygulama rolü parolası için `APPOINTMENT_DB_PASSWORD` bekler. Üretimde uygulama ve yönetim süreçleri dosya erişimi ayrı işletim sistemi kimlikleriyle çalıştırılmalı.
- Üretim derlemesinin `/api/health` uç noktası PostgreSQL sorgusu başarılıysa 200, bağlantı ya da şema hatasında 503 döndürür.

## Yedek

`npm.cmd run db:backup -- create` PostgreSQL tutarlı okuma anından dokuz uygulama tablosunu AES-256-GCM ile şifreleyerek `.local/backups` altında saklar. Aktif oturumlar kapsam dışıdır. `npm.cmd run db:backup -- verify <dosya>` yedeği geçici şemaya açarak tablolardaki satır sayılarını kontrol eder.

Yerel yedek aynı diskte bulunur. Üretim işletiminde şifreli dosyayı ayrı depoya taşı, anahtarı ayrı güvenli depoda tut ve zamanlanmış yedek ile geri yükleme tatbikatını izle. Bu yedek uygulama kayıtlarını kapsar. PostgreSQL sunucu ayarları, roller ve nokta-atışı kurtarma için üretim altyapısı ayrıca düzenlenir.

## Üretim kabulü

İl ve ilçeler, uygulamayla gelen [CC0 Türkiye idari birimler veri setinden](https://github.com/sabrigunes/turkey-administrative-units-dataset/tree/359332c0270b946621ca2ff816fc120253d689c1) alınıyor. İlk şema uygulamasında 81 il ve 973 ilçe referans tablosuna eklenir. Adı yalnız bir ilçeyle eşleşen eski işletme kayıtları otomatik bağlanır. Diğer işletmeler panelden il ve ilçe seçebilir. Referans verisi yedek doğrulamasında paketli veri setinden yeniden oluşturulur.

Kişisel öneri, son 365 günde aynı tarayıcıyla tamamlanan randevuların kategori sıklığını kullanır. Ziyaretçi çerezi bir yıl geçerlidir ve randevu kaydında yalnız özet değeri tutulur. Önceki anonim randevular otomatik olarak eşleştirilemez. Popüler işletmeler son 30 gündeki onaylı ve tamamlanan randevu sayısına göre sıralanır. İl/ilçe seçiliyse sıralama o bölgeyle sınırlıdır.

Yerel pilot tek işletme takvimi kapasitesi, 60 günlük randevu penceresi ve Türkiye saat dilimiyle çalışır. Keşifte tarayıcı konum izni ilk girişte istenir. URL'de il seçiliyse o bölge önceliklidir. Tam konum yalnız tarayıcı belleğinde kalır. Görünen harita sınırları sonuç sorgusu için uygulamaya gönderilir ve yanıt önbelleğe alınmaz. Her alanda en fazla 100 işletme gösterilir. İlçe merkezleri, [MIT lisanslı il ve ilçe koordinat veri setinden](https://github.com/AEKHer/il-ilce-koordinat/tree/cc0df81614f248d6dfbd3e584a1b910d3ae72c2d) ve OpenStreetMap verisinden türetilmiştir. Harita zemini OpenStreetMap tile hizmetinden alınır ve atıf haritada görünür. Hacimli üretim trafiği için tile planı incelenmeli. Yol tarifi bağlantısı seçili işletmenin koordinatını Google Haritalar'a iletir. Kart kapakları temsili kategori görselleridir. Sohbet açık sayfada beş saniyelik yenileme kullanır. Müşteri randevu erişimi rezervasyonu yaptığı tarayıcıyla sınırlıdır.

Yayından önce tamamlanacak işler:

- HTTPS ters vekil, istek boyutu ve hız sınırı, güvenlik başlıkları, günlük veri maskeleme ve izleme. Otomatik süreç yeniden başlatma ve bağlantı kesintisi testi.
- İşletme e-posta doğrulama, parola sıfırlama, personel/şube izinleri, sahte işletme ve yorum moderasyonu. Gerçek kullanıcıyla işlem öncesi veri saklama ve silme akışları.
- Yerel e-posta ve parola hesabı mevcut. Google girişi, e-posta doğrulama ve doğrulanmış cihazlar arası randevu erişimi açık. E-posta/SMS bildirim teslimi ve tekrar deneme bekliyor. Paneldeki randevu durumu güncellemeleri mevcut.
- Yedek otomasyonu, ayrı depolama, hedef sunucuya geri yükleme tatbikatı, gerçek HTTPS ve mobil PWA kurulum testi.
- Pilot işletme kabulü ve açık yayın onayı. Sağlık kategorileri ayrı hukuki ve ürün incelemesine bağlı.
