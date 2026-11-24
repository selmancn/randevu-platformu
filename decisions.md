# Mimari kararlar

## 2026-11-24 · Web/PWA ile başlangıç

**Onaylı ürün kararı.** Kullanıcı ilk sürüm için web/PWA'yı seçti. Mobil mağaza uygulamaları sonraki faza bırakıldı. İlk yerel teslim aynı Next.js ve TypeScript uygulamasında işletme paneliyle açık profili sunar. Ayrı API ve Expo başlangıç seçeneği ek dağıtım ve test gerektirir.

**İlk yerel uygulama kararı.** İlk teslimde dosyada kalıcı PGlite yeterliydi.

**Yürürlükteki karar.** Kullanıcı Supabase yerine yerel PostgreSQL istedi. Gerçek PostgreSQL 18 süreci proje altında, ayrı küme ve 55433 portu ile çalışır. Uygulama bağlantı havuzu sınırlı veritabanı rolünü kullanır. Çift rezervasyon, işletme satırı kilidi ve PostgreSQL aralık çakışma kısıtı ile engellenir. PGlite test ve eski dosya aktarımında kalır. Üretim işletim kabulü [OPERATIONS.md](OPERATIONS.md) içinde.
