# Spotify Glass Redesign

Interaktif HTML/CSS/JS prototip. Referanstaki soft pastel glassmorphism konseptine göre yeniden tasarlandı.

## Çalıştırma

Başka bir repoda açmak için bu klasörü kopyalaman yeterli:

```bash
# klasörü kopyala, sonra tarayıcıda aç
open index.html
# veya
npx serve .
```

Dosyalar:
- `index.html` — ekranlar
- `styles.css` — stil (light/dark, glass, radius, accent)
- `app.js` — navigasyon, swipe, long-press lyrics, tema

## Neler var

### Genel stil
- Soft pastel gradient arka plan
- Kart radius ~26px
- Belirgin ama soft blur + gölge
- Light mode varsayılan, sağ üstten dark mode
- Spotify yeşili (`#1DB954`) sadece aksan: play, mic, progress, shuffle

### Home
- Arama + mikrofon
- **Senin İçin Seçtiklerim** yatay kaydırılabilir büyük kartlar
- **Quick Play** widget kartları
- Kompakt **Recently Played**
- Kalın yüzen mini player — sola/sağa swipe ile şarkı değiştir

### Discover
- **Günün Ruhu** (saate göre değişen mood kartı)
- Moody Mix + gradient overlay
- Büyük **This is …** kartları → artist sayfası

### Artist
- Büyük kapak + liste (daha ferah boşluk)
- Play butonu hover/tap’te görünür
- Sabit **Shuffle Play**

### Now Playing
- Büyük kapak, kalın yuvarlak progress
- Büyük ortalanmış kontroller
- Ferah alt aksiyonlar (kalp / karıştır / sözler)
- Kapağa **uzun bas** → yarı şeffaf lyrics overlay

### Ekstra
- Liste satırında: sola kaydır → beğen, sağa kaydır → atla
- Büyük tıklama alanları (~48px)
- Kapak rengine göre ambient glow
