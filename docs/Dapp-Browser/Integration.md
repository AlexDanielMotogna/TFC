Plan: Integración con Phantom dApp Browser para Móvil
Problema
En móvil, cuando el usuario está en TFC (browser normal):

Click para abrir posición → salta a la app Phantom
Firma en Phantom → vuelve al browser
Falla por timeout (el cambio entre apps consume tiempo)
Solución de Pacifica: Su app se abre dentro de Phantom (dApp browser), así las firmas son instantáneas.

Solución
Cuando un usuario móvil visita TFC en su browser normal, mostrar un modal invitándole a abrir la app dentro de Phantom usando:


https://phantom.app/ul/?link={TFC_URL_ENCODED}
Dentro del browser de Phantom, window.phantom.solana está pre-inyectado y las firmas son instantáneas.

Archivos a Crear/Modificar
1. Crear utilidades de detección móvil
Nuevo: apps/web/src/lib/mobile.ts


export function isMobileDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod/i.test(ua);
}

export function isPhantomBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.phantom?.solana?.isPhantom) || /Phantom/i.test(navigator.userAgent);
}

export function getPhantomDeepLink(appUrl: string): string {
  return `https://phantom.app/ul/?link=${encodeURIComponent(appUrl)}`;
}
2. Crear componente de redirección
Nuevo: apps/web/src/components/MobilePhantomRedirect.tsx

Modal que detecta si estamos en móvil + browser normal, y ofrece abrir en Phantom.

3. Actualizar WalletProvider
Modificar: apps/web/src/components/WalletProvider.tsx

Detectar contexto: 'desktop' | 'mobile-browser' | 'phantom-browser'

Si estamos en phantom-browser, usar solo PhantomWalletAdapter (el provider ya está inyectado).

4. Agregar componente al layout
Modificar: apps/web/src/app/layout.tsx o AppShell.tsx

Renderizar <MobilePhantomRedirect /> para que aparezca el modal en móvil.

Flujo de Usuario
Usuario móvil visita tradefightclub.com en Safari/Chrome
App detecta: móvil + NO está en Phantom browser
Muestra modal: "Abre en Phantom para mejor experiencia"
Usuario hace click → redirige a https://phantom.app/ul/?link=...
Phantom abre TFC en su dApp browser interno
Ahora las firmas son instantáneas (sin cambio de app)
Verificación
Abrir TFC en Safari/Chrome móvil → debería mostrar modal
Click "Abrir en Phantom" → debería abrir Phantom con TFC dentro
Dentro de Phantom: conectar wallet → debería ser instantáneo
Abrir posición → firma instantánea, sin timeout
Verificar que en desktop NO aparece el modal