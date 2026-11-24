# Oracle dağıtımı

GitHub Actions, `main` dalına gönderilen kaynakları Node 24 ile test eder ve derler. Başarılı kontrolden sonra Oracle'daki kısıtlı SSH komutuna commit SHA'sını iletir. Oracle ARM64 üzerinde aynı commit yeniden derlenir, şema uygulanır ve systemd hizmeti başlatılır. Loopback sağlık kontrolü başarısızsa önceki uygulama sürümüne dönülür. Eklemeli şema değişiklikleri geriye sarılmaz.

- GitHub Actions sırları `ORACLE_DEPLOY_KEY` ve `ORACLE_KNOWN_HOSTS`. SSH anahtarı yalnız bu depoya ve sunucudaki sürüm komutuna ayrılmıştır.
- Uygulama `127.0.0.1:4312` üzerinde çalışır. PostgreSQL Oracle'da yereldir, veritabanı `randevu`. Şema ve uygulama rollerinin parolaları ayrı sunucu dosyalarında saklanır. Yerel demo kayıtları taşınmaz.
- Herkese açık adres [randevu-platformu.selman-cinn.workers.dev](https://randevu-platformu.selman-cinn.workers.dev). Cloudflare Worker, şifreli tünel üzerinden Oracle içindeki Nginx'e (`127.0.0.1:4313`) ulaşır. Uygulama ve veritabanı Oracle'dadır. `wrangler deploy --config deploy/oracle/wrangler.json` yalnız sınır vekilini günceller.
- Doğrudan `randevu.130-61-82-184.sslip.io` sertifikalı Oracle sanal sunucusudur. OCI TCP 443 girişi dışarıdan erişilemediği için canlı giriş tüneli kullanır. Mevcut Logicbex sanal sunucusu ayrıdır. Certbot etkinse `reload-nginx.sh` yenileme sonrası yapılandırmayı doğrular ve Nginx'i yeniden yükler.
- `bootstrap.sh`, gerekli sistem paketleri kurulduktan sonra yönetici tarafından çalıştırılır. Aynı dizinde `deploy.pub` adında CI anahtarının açık kısmı bulunmalıdır. Workflow, yüklenmiş sürüm komutunu ve systemd yapılandırmasını kullanır. Bu iki dosyanın sonraki değişiklikleri sunucuda yönetici tarafından uygulanır.
- Yerel çalışma ve sağlık kontrolleri [işletim belgesinde](../../OPERATIONS.md). Yayın otomasyonu ile ticari ürün kabulü farklı işlerdir. E-posta doğrulaması ve üretim yedekleme politikası ayrıca tamamlanır.
