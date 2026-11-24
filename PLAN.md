# Yerel Hizmet ve Randevu Platformu — Ürün ve Geliştirme Planı

**24 Kasım 2026 · Yerel PostgreSQL pilotu.** Kullanıcı web/PWA ile başlamayı ve Supabase yerine yerel PostgreSQL kullanmayı seçti. Ürün Next.js, TypeScript ve PostgreSQL 18 ile yerelde çalışır. Pilot ilçe, marka, fiyatlandırma ve bütçe TBD. `randevu-platformu` geçici klasör adı.

## Ürün hedefi

İşletme kendi hizmetlerini, tarifesini, takvimini ve günlük gelir-giderini tek panelden yönetir. Müşteri yakındaki işletmeleri keşfeder, hizmet ve fiyatı görür, saat seçer veya talep bırakır, gelemeyeceğini bildirir, izin verildiğinde sohbet eder ve tamamlanan hizmeti değerlendirir. İşletmenin paylaşılabilir profili, platformda henüz az işletme varken de mevcut müşterilerine randevu linki vermesini sağlar.

| Rol | Yetki |
| --- | --- |
| Ziyaretçi ve müşteri | Herkese açık profil ve katalog. Oturum açan müşteri kendi randevu, sohbet ve değerlendirmelerine erişir. |
| İşletme sahibi | Kayıt, profil, şube, personel, hizmet, tarife, takvim, sohbet ayarı ve mali raporlar. |
| Personel | Atanmış şube ve izinleri kapsamında takvim ve randevu. Mali verilere erişim ayrıca yetkilendirilir. |
| Platform yöneticisi | İşletme doğrulama ve yayına alma, şikâyet ve moderasyon. Hassas erişim gerekçeli ve denetlenebilir. |

## Randevu ve hizmet kuralları

- Hizmet başına sabit fiyat, başlangıç fiyatı veya teklif usulü. Süre ve rezervasyon biçimi ayrı alanlar. Anında rezervasyon için süre, uygun personel/kaynak ve takvim gerekir. Dövme ve arıza tespiti gibi belirsiz işlerde talep akışı kullanılabilir.
- **Saat seçimi.** Çalışma saatlerinden mola, izin, blokaj ve dolu aralıklar çıkarılır. Müşteri boş saat seçer. Sunucu uygunluğu tekrar kontrol eder ve tek işlemde onaylar. Aynı personel, koltuk veya lift için çakışma veritabanında engellenir.
- **Talep.** Müşteri tercih ettiği gün veya saat aralığını iletir. İşletme talep edilen saate onay verebilir veya alternatif saat önerir. Alternatifi müşteri kabul eder. Bekleyen talepler slotu kilitlemez ve onay anında uygunluk tekrar hesaplanır. Talepler için yanıt süresi ve zaman aşımı olacak.
- Durumlar `talep`, `saat önerildi`, `onaylı`, `tamamlandı`, `reddedildi`, `iptal`, `süresi doldu` ve `gelmedi`. Onaylı randevuda “Gelemeyeceğim” iptali ve işletme bildirimini tek işlemde kaydeder, slotu açar. İşletmenin son iptal saati kuralı varsa süre sonrasında da bildirim işletmeye ulaşır ve işlem sonucu müşteriye gösterilir.
- Randevuda hizmet adı, süre ve rezervasyondaki fiyat saklanır. Kesin satış tutarı, tahsilat ve varsa iade ayrıca kaydedilir. Tarife değişikliği geçmiş randevuları değiştirmez.

## Raporlar, keşif ve iletişim

- **İşletme paneli.** Gün, ay ve tarih aralığında hizmet adedi, satış cirosu, tahsilat, iade, gider ve nakit farkı. İşletme manuel satış ve kategorili gider ekleyebilir. Randevu tamamlamak satış kaydını ve tahsilatı ayrı ayrı izler. Her randevu için en fazla bir bağlı satış oluşur. Ödeme ve gider raporunda gerçekleşme tarihleri esas alınır. Para kuruş cinsinden tam sayı, rapor günü şubenin saat diliminde tutulur. İptal ve gelmeme satışa yazılmaz. CSV dışa aktarımı eklenir. Resmî muhasebe, fatura ve vergi entegrasyonları ileri kapsam.
- **Keşif.** İlçe ve kategoriyle giriş yapmadan arama. İzin verilirse mevcut konuma göre yakınlık sıralaması. Konum izni yoksa elle bölge seçimi. İşletme profili, hizmet fiyatı, uygunluk ve değerlendirme sayısı gösterir.
- **Puanlar.** Tamamlanmış randevuya bağlı bir değerlendirme. İşletme puanı ile alınan hizmetin puanı ayrı alanlar. Şikâyet ve moderasyon kaydı tutulur.
- **Canlı sohbet.** İşletme panelden açıp kapatır. Kapalıyken yeni mesaj gönderilemez, yetkili taraflar geçmişi görebilir. İlk sürüm metin mesajı, okunmadı durumu ve şikâyet desteği içerir. Her mesaj ve canlı kanal için katılımcı yetkisi kontrol edilir.
- **Sağlık sektörü.** Diş hekimliği ilk pilot dışında. Randevu türünün dahi sağlık bilgisi açığa çıkarabileceği değerlendirilir. Veri işleme koşulları, tanıtım ve fiyat/yorum yayını, sohbet, roller, saklama ve veri aktarımı incelendikten sonra sektöre özgü yayın kuralları belirlenir. [KVKK rehberi](https://www.kvkk.gov.tr/Icerik/8183/Ozel-Nitelikli-Kisisel-Verilerin-Islenmesine-Iliskin-Rehber) · [Sağlık Bakanlığı yönetmelik duyurusu](https://shgmdenetimdb.saglik.gov.tr/TR-111587/saglik-hizmetlerinde-tanitim-ve-bilgilendirme-faaliyetleri-hakkinda-yonetmelik-yayimlanmistir.html)

## Teknoloji seçenekleri

| Seçenek | Faydası | Üstlenilecek iş |
| --- | --- | --- |
| **A · Next.js ve TypeScript, yerel PostgreSQL. Seçildi.** | Müşteri web/PWA ve işletme paneli tek uygulamada. PostgreSQL zaman aralığı ve çakışma kısıtı çift rezervasyonu engeller. Windows geliştirme ortamında PostgreSQL proje dizininde çalışır. | Üretim sunucusu, HTTPS, işletim ve hesap doğrulama ayrıca tamamlanır. |
| B · Next.js web, NestJS API ve PostgreSQL, Expo mobil | Ayrı API ve mağaza uygulamaları ilk günden. Web ile mobil bağımsız geliştirilir. | Birden fazla uygulama, dağıtım ve test yüzeyi. Pilot kurulumu daha uzun. |

Web ve ilerideki Expo istemcisi için iş kuralları arayüzden ayrılır. App Store ve Google Play dağıtımı ayrı fazdır. Yerel pilotta işletme verileri oturum ve işletme kimliği üzerinden kapsamlanır. Personel/şube üyeliği üretim kabul işidir. Üretim sağlayıcısı, e-posta/SMS, harita sağlayıcısı ve abonelik fiyatı açık kararlar. Yerel geliştirme sentetik veriyle yürütülür. [İşletim ve üretim kabulü](OPERATIONS.md) · [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps) · [PostgreSQL zaman aralıkları](https://www.postgresql.org/docs/17/rangetypes.html)

## Geliştirme sırası ve kabul ölçütleri

İlk pilot önerisi tek ilçede berber. Aynı akışlara dövmeci ve oto servisinin talep usulü senaryoları test verisi olarak eklenir. İşletme paneli ve müşteriye açık profil ilk teslimde birlikte çalışır.

| Görev | Durum | Bağımlılık ve doğrulama ölçütü |
| --- | --- | --- |
| RP-01 · Teknoloji ve pilot seçimi | in-progress | Web/PWA kararı kayıtlı. Berber pilot önerisi ve ilk ilçe açık. Pilot seçimi yerel geliştirmeyi engellemez. |
| RP-02 · Kayıt, panel ve katalog | in-progress | PostgreSQL işletme kaydı ve oturumu `/panel` altında, müşteri e-posta hesabı `/hesap` altında. İşletme hizmet ekleyebilir, tarifeyi düzenleyebilir ve hizmeti pasifleştirebilir. Google girişi, şube/personel üyeliği, e-posta doğrulama ve parola sıfırlama bekliyor. |
| RP-03 · Takvim, iki randevu akışı ve bildirimler | in-progress | Boş saat, çift rezervasyon, müşteri iptali, onaylı talep ve alternatif saat yerelde doğrulandı. Dış bildirim, talep zaman aşımı ve randevu kaynakları bekliyor. |
| RP-04 · Satış, tahsilat, gider ve rapor | in-progress | Hazır ve özel tarih aralıkları, günlük seri grafiği, seçili aralık CSV’si ve hizmete göre satış eklendi. Gider kategorileri ve tahsilat/iade ilişkilendirmesi bekliyor. |
| RP-05 · Yerel keşif ve değerlendirme | in-progress | Fotoğraflı kartlar, arama önerileri, bağlı il/ilçe, kişisel öneri ve yerel popülerlik var. Harita tekerlekle yakınlaşır, konum izni alabilir ve görünür alandaki işletmeleri listeye yansıtır. İşaretçi kartı puan, kategori, ilçe, profil ve yol tarifi gösterir. İşletme detayında hizmet tarifesi, çalışma saatleri ve mobil randevu çubuğu var. Fotoğraf yükleme ve moderasyon bekliyor. |
| RP-06 · Canlı sohbet | in-progress | Katılımcı bazlı randevu sohbeti, aç/kapat ve beş saniyelik otomatik yenileme doğrulandı. Okunmadı durumu ve şikâyet bekliyor. |
| RP-07 · Kapalı pilot ve PWA | in-progress | Yerel üretim derlemesi, mobil tarayıcı ve şifreli yedek geri yükleme geçti. Üretim HTTPS, gerçek cihaz kurulumu, bildirim teslimi ve pilot kabulü bekliyor. |
| RP-08 · Mobil mağazalar ve sektör genişlemesi | todo | RP-07. Pilot ölçümleriyle Expo, yeni sektör ve gelişmiş finans önceliği kararlaştırılır. Sağlık ayrı incelemeye bağlıdır. |

İlk kod tesliminde oturum, işletme üyeliği, hizmet kataloğu ve herkese açık profil ayrı modüller olur. Veritabanı migration ve sentetik veri yükleme dosyaları sürümlenir. Birim, gerçek PostgreSQL entegrasyon ve tarayıcı testleri sırayla çalıştırılır. Her randevu ve mali işlem sunucuda yetki kontrolü, zaman damgası ve tekrar deneme koruması taşır.

## Pilot ve gelir modeli

Önerilen deney 3–5 işletmeyle kapalı pilot. İşletmelere paylaşılabilir randevu linki ve kurulum desteği verilir. Reklam bütçesi öncesinde aktif işletme, görüntülemeden randevuya geçiş, talebe yanıt süresi, iptal/gelmeme ve haftalık panel kullanımı izlenir. Gelir modeli için kurulum ücreti ve/veya işletme aboneliği test edilir. Müşteri tarafında randevu almak ücretsiz önerilir. Fiyat ve reklam bütçesi TBD. İlk pilotta işletme kendi tahsilatını kaydeder. Müşteriden uygulama içinde ödeme alma sonraki ürün kararıdır.
