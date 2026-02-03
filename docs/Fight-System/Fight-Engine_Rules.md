# Fight Engine – Rules & Constraints (Final)

> **Implementation Status**: All rules implemented and tested as of 2026-01-21.
> See [FIGHT_PNL_CALCULATION.md](./FIGHT_PNL_CALCULATION.md) for technical implementation details.

## Implementation Files

| Component | File |
|-----------|------|
| Backend Engine | `apps/realtime/src/fight-engine.ts` |
| PnL Calculator | `apps/realtime/src/fight-pnl-calculator.ts` |
| Unit Tests | `apps/realtime/src/fight-pnl-calculator.test.ts` |
| WebSocket Events | `packages/shared/src/events/ws-events.ts` |
| Frontend Hook | `apps/web/src/hooks/useSocket.ts` |

---

## 1. Alcance y principio fundamental

1. El **fight engine es un sistema lógico aislado**.
2. **Solo se contabiliza lo que ocurre explícitamente dentro de la app**.
3. La **base de datos interna** es la **única fuente de verdad** para:

   * Trades del fight
   * Asociación con fightId
   * Cálculo de PnL
4. Cualquier acción que ocurra fuera de la app, aunque sea ejecutada en Pacifica, **no forma parte del fight**.

---

## 2. Reglas temporales del fight

5. Cada fight tiene:

   * `startTime`
   * `endTime`
6. **Solo los trades abiertos y cerrados dentro de ese intervalo cuentan**.
7. El momento determinante para un trade es:

   * **Apertura**
   * **Cierre**
     Ambos deben ocurrir dentro del fight.

---

## 3. Órdenes y posiciones pre-fight

8. Toda orden o posición **abierta antes del startTime** se considera **pre-fight**.
9. Órdenes pre-fight **no cuentan**, incluso si:

   * Se ejecutan durante el fight.
   * Se cierran durante el fight.
10. El fight engine **nunca reasigna** un trade pre-fight como trade del fight.

---

## 4. Trades abiertos fuera de la app (Pacifica directo)

11. Si un usuario, durante un fight:

    * Abre una posición **directamente desde Pacifica** (web, app externa, API externa),
    * Esa posición **NO cuenta para el fight**.
12. Aunque la posición:

    * Se abra durante el fight,
    * Se cierre durante el fight,
    * Exista en Pacifica,
      **no será considerada válida**.
13. Para ser válida, una posición debe:

    * Ser iniciada **explícitamente desde la app**.
    * Estar registrada en la base de datos interna.
    * Tener asignado un **fightId**.
14. El fight engine **no confía en Pacifica como fuente de lógica**, solo como proveedor de ejecución.

---

## 5. Registro y almacenamiento de trades

15. **Todos los trades se guardan en la base de datos**.
16. Los trades válidos del fight:

    * Tienen un `fightId` en la tabla general de trades.
    * Se reflejan también en la tabla específica `fight_trades`.
17. Un trade sin `fightId` **no puede afectar** el resultado de ningún fight.

---

## 6. Reglas de PnL (Profit & Loss)

18. El **PnL del fight** se calcula **únicamente** a partir de:

    * Trades válidos del fight.
    * Trades completamente cerrados.
19. **Posiciones abiertas no generan PnL**.
20. Si el fight termina y existen posiciones abiertas:

    * El fight se da por finalizado.
    * Esas posiciones **no se incluyen** en el PnL.
21. Para que el PnL sea válido:

    * **Todas las posiciones del fight deben estar cerradas antes del endTime**.

---

## 7. Fees incluidos en el PnL (corrección importante)

22. El PnL del fight **DEBE incluir todas las fees de trading**.
23. Las fees incluyen:

    * **Trading fees de Pacifica** (maker / taker).
    * **Fee adicional de la plataforma: 0.05%** via Builder Code.
24. El cálculo del PnL es:

    * **PnL bruto**
    * **menos fees totales** (ya incluyen fee de plataforma via Builder Code)
25. El PnL mostrado en el fight es siempre:

    * **PnL neto real**, después de todas las fees.

---

## 8. Uso de la API de Pacifica para fees (Builder Code)

26. La plataforma utiliza **Builder Code** de Pacifica para cobrar fees:

    * El fee de la plataforma (0.05%) se configura como Builder Fee
    * Pacifica **combina** el fee base + builder fee en un solo cargo
    * El campo `fee` devuelto por Pacifica **ya incluye** ambos fees
27. Esto significa:

    * **No hay cálculo separado** de platform fee en el código
    * El `trade.fee` de Pacifica es el fee total (Pacifica + TFC)
    * El `trade.pnl` de Pacifica ya descuenta todas las fees
28. Esto garantiza:

    * Precisión del PnL sin doble conteo de fees.
    * Consistencia entre Pacifica y la app.
    * Builder fees son enviados automáticamente a la cuenta de TFC.

---

## 9. Notificación antes del cierre del fight

30. **30 segundos antes del endTime**, el sistema debe:

    * Notificar al usuario.
31. El mensaje debe indicar claramente:

    * Que todas las posiciones deben cerrarse.
    * Que las posiciones abiertas no contarán para el fight.
32. La notificación es informativa:

    * No hay cierre forzoso automático.

---

## 10. Principio de seguridad y equidad

33. El fight engine está diseñado para:

    * Evitar manipulación externa.
    * Evitar uso de trades fuera de la app.
    * Garantizar igualdad de condiciones.
34. Solo lo que:

    * Se ejecuta desde la app,
    * Se registra en la DB,
    * Cumple las reglas temporales,
      **afecta el resultado del fight**.
35. Si un asset se compra en pacifica pero se vende en TFC en un fight no deberia pasar nada como si la transaccion no existiera

    * Usuario compra pre-fight o in fight assets en Pacifica pero los vende en TFC en el fight
    * Esto no deberia contar como Fight Capital Limit ni afectar al PNL


36. Si un jugador deberia poder cerrar solo las posiciones de los assets que estan en el fight only desde fight only view! Aun asi si tiene el mismo asset pre comprado el system debe saber lo que el usuario compro en el fight y mostrar esos detalles en las tablas de posiciones, open order, trade history y open orders...

---

## 11. Detección de Trades Externos (Actualizado 2026-02-01)

37. **Método de detección simplificado**: Comparación BUY vs SELL por símbolo.

38. **Lógica**: Para cada símbolo en `fight_trades`:
    * Sumar todas las cantidades BUY
    * Sumar todas las cantidades SELL
    * Si SELL > BUY → trades externos detectados
    * El usuario no puede vender más de lo que compró a través de TFC

39. **Ejemplo de detección**:
    ```
    Usuario compra 0.13 SOL via TFC
    Usuario vende 0.27 SOL via TFC
    → SELL (0.27) > BUY (0.13)
    → Diferencia: 0.14 SOL vino de fuente externa
    → ¡Trades externos detectados!
    ```

40. **Registro de violaciones**: Cuando se detectan trades externos:
    * Se crea un registro en `anti_cheat_violations`
    * `ruleCode`: 'EXTERNAL_TRADES'
    * `actionTaken`: 'FLAGGED'
    * Se actualiza `externalTradesDetected = true` en FightParticipant
    * Se emite evento WebSocket `EXTERNAL_TRADES_DETECTED`

41. **Timing**: La detección se ejecuta al finalizar el fight (no durante).

---

## 12. Anti-Cheat y Detección de Trampas

42. El sistema debe detectar tramposos, fights que terminan en draw con 0% - 0% pnl, se puede considerar que una persona con mas cuentas esta entrando en sus propios fights y dejando la cuenta a 50% de winrate sin hacer ningun trading. Este tipo de fights no deben contar en el PNL o ranking del usuario, ningun fight que termine con 0% - 0% pnl

43. La applicacion debe deducir cuando se esta intentanto hacer trampas, por ejemplo debemos 