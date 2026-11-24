# Oracle dağıtımı

GitHub Actions, `main` dalına gönderilen kaynakları Node 24 ile test eder ve derler. Başarılı kontrolden sonra Oracle'daki kısıtlı SSH komutuna commit SHA'sını iletir. Oracle ARM64 üzerinde aynı commit yeniden derlenir, şema uygulanır ve systemd hizmeti başlatılır. Loopback sağlık kontrolü başarısızsa önceki uygulama sürümüne dönülür. Eklemeli şema değişiklikleri geriye sarılmaz.

- GitHub Actions sırları `ORACLE_DEPLOY_KEY` ve `ORACLE_KNOWN_HOSTS`. SSH anahtarı yalnız bu depoya ve sunucudaki sürüm komutuna ayrılmıştır.
- Uygulama `127.0.0.1:4312` üzerinde çalışır. PostgreSQL Oracle'da yereldir, veritabanı `randevu`. Şema ve uygulama rollerinin parolaları ayrı sunucu dosyalarında saklanır. Yerel demo kayıtları taşınmaz.
- Nginx, `randevu.130-61-82-184.sslip.io` sanal sunucusuyla trafiği HTTPS üzerinden uygulamaya iletir. Mevcut Logicbex sanal sunucusu ayrıdır. Adres, kullanıcıya ait özel alan adı bağlanana kadar Oracle IP'sine bağlıdır.
- `bootstrap.sh`, gerekli sistem paketleri kurulduktan sonra yönetici tarafından çalıştırılır. Aynı dizinde `deploy.pub` adında CI anahtarının açık kısmı bulunmalıdır. Workflow, yüklenmiş sürüm komutunu ve systemd yapılandırmasını kullanır. Bu iki dosyanın sonraki değişiklikleri sunucuda yönetici tarafından uygulanır.
- Yerel çalışma ve sağlık kontrolleri [işletim belgesinde](../../OPERATIONS.md). Yayın otomasyonu ile ticari ürün kabulü farklı işlerdir. E-posta doğrulaması ve üretim yedekleme politikası ayrıca tamamlanır.
