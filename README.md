# Randevu Platformu

Kapsam, fazlar ve görevler [ürün planında](PLAN.md). [Mimari karar](decisions.md) yerel veri katmanı ile üretim hedefini açıklar.

## Yerelde çalıştırma

```powershell
npm.cmd ci
npm.cmd run db:local
```

PostgreSQL süreci açıkken ikinci terminalde:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 4312
```

Tarayıcıda http://127.0.0.1:4312 adresi müşteri keşfini açar. Müşteriler `/hesap` üzerinden e-posta ve parolayla kayıt olabilir. İşletme girişi ve kayıt için http://127.0.0.1:4312/panel adresini kullan. **Yeni işletme kaydı** ile sentetik bilgiler gir, panelden hizmet ve çalışma saatlerini ekle, **Müşteri profilini aç** bağlantısını kullan. Veriler PostgreSQL 18'in proje içindeki `.local/postgres` dizinine yazılır. PostgreSQL yalnızca `127.0.0.1:55433` adresini dinler.

Kontroller `npm.cmd test`, `npm.cmd run typecheck` ve `npm.cmd run build`. Derlenmiş uygulama `npm.cmd run start -- --hostname 127.0.0.1 --port 4312` ile açılır. Sağlık uç noktası `/api/health`. [İşletim ve yayın kontrolü](OPERATIONS.md) için yedek ve kalan kabul ölçütlerine bak.

[Konum verilerinin kaynakları ve lisansları](data/README.md).
