# Trade Fight Club - Social Media Assets

## 📁 Contenido de esta Carpeta

Este directorio contiene la estrategia completa de contenido para X (Twitter) con 5 posts diseñados para captar traders competitivos.

### Archivos Incluidos

```
assets/social/
├── README.md                    ← Este archivo
├── COPY.md                      ← Copy completo + estrategia detallada
├── post-1-monday.html           ← Visual: Problem/Solution
├── post-2-tuesday.html          ← Visual: Features showcase
├── post-3-wednesday.html        ← Visual: Prizes/Leaderboard
├── post-4-thursday.html         ← Visual: Trust/Security
└── post-5-friday.html           ← Visual: CTA/Urgency
```

---

## 🎯 Estrategia de 5 Días

| Día | Objetivo | Tema | Imagen |
|-----|----------|------|--------|
| **Lunes** | Agitar problema | Trading solitario vs PvP | Split screen comparison |
| **Martes** | Educar features | Herramientas profesionales | Feature grid |
| **Miércoles** | FOMO social | Prizes + leaderboard | Podium visual |
| **Jueves** | Generar confianza | Non-custodial security | Security badges |
| **Viernes** | Conversión máxima | Beta access CTA | Urgency design |

---

## 🖼️ Cómo Exportar las Imágenes

Cada archivo HTML genera una imagen de **1200x675px** (16:9, optimizado para X).

### Opción 1: Chrome DevTools (Recomendado)

1. Abre el archivo HTML en Chrome
2. Presiona `F12` → DevTools
3. `Ctrl+Shift+P` (Windows) o `Cmd+Shift+P` (Mac)
4. Escribe "Capture node screenshot"
5. Selecciona el elemento `.post` en el inspector
6. Chrome guardará un PNG perfecto

### Opción 2: Puppeteer Script

Si tienes Node.js instalado:

```bash
# Desde la raíz del proyecto
cd assets
node ../export-banner.js
```

(Modifica `export-banner.js` para exportar cada post automáticamente)

### Opción 3: Screenshot Manual

Abre el HTML en navegador y usa:
- **Windows:** Snipping Tool
- **Mac:** Cmd+Shift+4 y recorta exactamente el banner

---

## ✍️ Copy para Cada Post

Todo el copy está en [`COPY.md`](./COPY.md), incluyendo:

- ✅ Tweet principal (280 chars)
- ✅ Thread opcional para comentarios
- ✅ Hashtags optimizados
- ✅ Timing recomendado
- ✅ Objetivos de engagement

**Ejemplo de estructura:**

```
Copy Principal (tweet)
↓
Imagen (1200x675)
↓
Thread en comentarios (opcional)
↓
Engagement manual (responder comentarios)
```

---

## 📅 Calendario de Publicación

**Hora Recomendada:** 10:00 AM EST todos los días
- Máximo engagement en crypto Twitter
- Europa ya despierta, USA comenzando día

**Días:**
- Lunes → Post 1 (Problem)
- Martes → Post 2 (Features)
- Miércoles → Post 3 (Prizes)
- Jueves → Post 4 (Security)
- Viernes → Post 5 (CTA)

**Fin de semana:** Engagement orgánico
- Retweets de user wins
- Live fight updates
- Community replies

---

## 🎨 Personalización de Imágenes

Si necesitas modificar algún visual:

1. Abre el archivo HTML en tu editor
2. Busca la sección que quieres cambiar
3. Edita CSS o contenido directamente
4. Refresca navegador para ver cambios
5. Exporta de nuevo

### Elementos Editables Clave:

**Colores:**
- Naranja primario: `#f97316`
- Azul: `#0ea5e9`
- Teal: `#26A69A`
- Background: `#0c0c0e`

**Fuentes:**
- Sans: Inter (Google Fonts)
- Monospace: Roboto Mono (para stats)

**Logos/Iconos:**
- Logo TFC: `../../apps/web/public/images/logos/favicon-white-512.png`
- Crypto icons: `../../crypto_assets_loogos/`

---

## 📊 Métricas de Éxito

**Week 1 Target:**
- 500-1,000 impressions por post
- 10-20 beta applications
- 5%+ engagement rate

**Week 4 Target:**
- 5,000+ impressions por post
- 100+ beta users activos
- 10%+ engagement rate

**Trackear:**
- Clicks to website
- Beta applications
- Comments/RTs/Likes
- Conversion: applicant → active trader

---

## 🚀 Checklist Pre-Publicación

Antes de postear cada día:

- [ ] Imagen exportada (1200x675)
- [ ] Copy revisado (spelling/grammar)
- [ ] Hashtags incluidos (3-5 relevantes)
- [ ] URL acortada si necesario
- [ ] Thread preparado (si aplica)
- [ ] Timing programado (10 AM EST)
- [ ] Notificaciones activadas (responder rápido)

---

## 💡 Tips para Máximo Engagement

### DO ✅
- Responder comentarios en primeros 30min
- Pin thread en comentario para ampliar info
- RT user wins y testimonials
- Tag @solana y @Pacifica_ex cuando relevante
- Usar emojis estratégicamente (no spam)
- A/B test copy variations

### DON'T ❌
- Más de 5 hashtags (se ve spam)
- Ignorar comentarios negativos
- Postear sin imagen (70% menos engagement)
- Copy genérico sin personalidad
- Prometer returns específicos
- Comparar directamente con CEXs (legal risk)

---

## 🔄 Estrategia de Reciclaje

**Después de Semana 1:**

Puedes reciclar estos posts con variaciones:

1. **Actualizar stats** - Refresh prizes, volume, fights
2. **Nuevos testimonials** - Feature real user wins
3. **Seasonal hooks** - "New year, new trading strategy"
4. **Event-based** - Tie to Solana ecosystem news

**Frequency:** Reciclar un post cada 2-3 semanas (con refreshes)

---

## 📞 Soporte y Feedback

**¿Problemas con exports?**
- Verifica rutas de imágenes relativas
- Usa Chrome (Safari a veces falla con exportación)
- Asegúrate fonts carguen (Google Fonts)

**¿Quieres más posts?**
- Sigue la misma estructura visual
- Mantén consistencia de marca (colores, fonts)
- Varía formato para evitar fatiga

**¿Feedback de comunidad?**
- Analiza qué posts performan mejor
- Ajusta copy basado en engagement
- Experimenta con timing diferentes

---

## 📖 Recursos Adicionales

- **Brand Guidelines:** Ver `docs/Brand-Guidelines.md` (si existe)
- **Icon System:** `docs/Icon-System.md`
- **Landing Page Copy:** `apps/web/src/components/landing/`
- **FAQ Answers:** `apps/web/src/components/landing/FAQSection.tsx`

---

## 🎯 Next Steps

1. **Esta Semana:**
   - Exportar los 5 posts
   - Revisar copy en COPY.md
   - Programar posts para Lun-Vie
   - Preparar respuestas a FAQs comunes

2. **Próxima Semana:**
   - Analizar métricas de engagement
   - Crear variaciones de top performers
   - Recopilar user testimonials
   - Planear Semana 2 content

3. **Mes 1:**
   - Expandir a video content (reels, TikTok)
   - Colaboraciones con Solana influencers
   - User-generated content campaign
   - Community contests/challenges

---

**Creado:** Enero 2025
**Última actualización:** Enero 2025
**Mantenedor:** Marketing Team

¡Buena suerte con el lanzamiento! 🚀⚔️
