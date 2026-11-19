# Cocos Challenge - Backend

API REST para consultar el portfolio de un usuario, buscar activos y enviar órdenes al mercado. Hecha con NestJS, TypeScript y PostgreSQL.

- [Cómo correrlo](#cómo-correrlo)
- [Endpoints](#endpoints)
- [Decisiones y supuestos](#decisiones-y-supuestos)
- [Lo que encontré en los datos](#lo-que-encontré-en-los-datos)
- [Arquitectura](#arquitectura)
- [Tests](#tests)
- [Qué haría con más tiempo](#qué-haría-con-más-tiempo)

## Cómo correrlo

Requisitos: Node 22 o superior y Docker.

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run start:dev
```

La API queda en `http://localhost:3000`.

`docker compose up` levanta un Postgres 17 local y, la primera vez, carga el `database.sql` original del challenge (`db/init/01_schema_and_seed.sql`, sin modificar) y los índices que agregué (`db/init/02_indexes.sql`). El puerto solo escucha en `127.0.0.1`.

Para volver la base al estado inicial:

```bash
docker compose down -v && docker compose up -d
```

### Contra la base de Neon

Alcanza con poner la connection string en `DATABASE_URL` dentro de `.env`. En ese caso los índices no están, se pueden crear corriendo `db/init/02_indexes.sql` (usa `IF NOT EXISTS`). Los tests nunca corren contra esa base, ver [Tests](#tests).

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | API en modo watch |
| `npm run build` / `npm run start:prod` | Build y ejecución compilada |
| `npm test` | Tests unitarios (no necesitan base) |
| `npm run test:e2e` | Tests funcionales contra Postgres local |
| `npm run lint` / `npm run typecheck` | ESLint y chequeo de tipos |

## Endpoints

Hay ejemplos listos para usar en [`requests.http`](requests.http) (REST Client) y en [`postman/`](postman/cocos-challenge.postman_collection.json).

### `GET /users/:userId/portfolio`

```json
{
  "userId": 1,
  "totalValue": "889756.00",
  "cash": "753000.00",
  "reservedCash": "125500.00",
  "availableCash": "627500.00",
  "positions": [
    {
      "instrumentId": 47,
      "ticker": "PAMP",
      "name": "Pampa Holding S.A.",
      "quantity": 40,
      "availableQuantity": 40,
      "averageCost": "930.00",
      "lastPrice": "925.85",
      "marketValue": "37034.00",
      "totalReturnPercent": "-0.45",
      "dailyReturnPercent": "0.44"
    }
  ]
}
```

`availableCash` son los pesos disponibles para operar. `cash` es el saldo total, incluyendo lo que está reservado por órdenes pendientes. Usuario inexistente: 404.

### `GET /instruments?search=pamp&limit=20`

Busca por ticker o por nombre, sin distinguir mayúsculas. Devuelve el último precio y el rendimiento diario de cada activo. `search` es obligatorio (1 a 50 caracteres) y `limit` va de 1 a 50, por defecto 20.

```json
[
  {
    "id": 47,
    "ticker": "PAMP",
    "name": "Pampa Holding S.A.",
    "type": "ACCIONES",
    "lastPrice": "925.85",
    "dailyReturnPercent": "0.44",
    "priceDate": "2023-07-14"
  }
]
```

### `POST /orders`

```json
{ "userId": 1, "instrumentId": 47, "side": "BUY", "type": "MARKET", "size": 10 }
{ "userId": 1, "instrumentId": 47, "side": "BUY", "type": "MARKET", "amount": 10000 }
{ "userId": 1, "instrumentId": 45, "side": "BUY", "type": "LIMIT", "size": 20, "price": 700.5 }
```

Se manda `size` (cantidad de acciones) o `amount` (monto en pesos), nunca los dos. `price` es obligatorio en LIMIT y no se acepta en MARKET.

```json
{
  "id": 12,
  "userId": 1,
  "instrumentId": 47,
  "side": "BUY",
  "type": "MARKET",
  "status": "FILLED",
  "size": 10,
  "price": "925.85",
  "createdAt": "2026-11-19T17:41:14.328Z",
  "rejectionReason": null
}
```

### `PATCH /orders/:id/cancel`

Body: `{ "userId": 1 }`. Cancela una orden en estado NEW. No lo pide el enunciado, pero el estado CANCELLED existe y sin este endpoint no había forma de liberar una reserva.

### Errores

Todos los errores tienen la misma forma. Los de negocio traen un `code` estable:

```json
{ "statusCode": 400, "error": "Bad Request", "message": "LIMIT orders require a price", "code": "PRICE_REQUIRED" }
```

## Decisiones y supuestos

### Las órdenes LIMIT pendientes reservan saldo

Una LIMIT de compra en NEW bloquea `size × price` en pesos, y una LIMIT de venta en NEW bloquea las acciones. El enunciado pide devolver los "pesos disponibles para operar", y si no reservo, un usuario con $100.000 puede dejar diez órdenes límite de $100.000 cada una. Si se ejecutaran, quedaría con saldo negativo.

Por eso el portfolio muestra las dos cosas: `cash` (lo que tiene) y `availableCash` (lo que puede usar). Para el valor total de la cuenta uso `cash`, porque la plata reservada sigue siendo del usuario.

Es la decisión más discutible. La alternativa simple es no reservar y validar cada orden contra el saldo total, pero me parece que deja abierto justamente el caso que el enunciado pide evitar.

### Las posiciones se calculan desde `orders` en cada lectura

El enunciado dice que la tenencia y los pesos se calculan con los movimientos de `orders`, así que no agregué una tabla de posiciones. La ventaja es que no hay nada que se pueda desincronizar. La desventaja es que el costo crece con la cantidad de órdenes por usuario. Con más volumen, haría lo que explico en [Qué haría con más tiempo](#qué-haría-con-más-tiempo).

Para las posiciones uso solo órdenes FILLED, como pide el enunciado. Las NEW se usan únicamente para calcular reservas.

### Rendimiento total con costo promedio ponderado

- Cada compra suma `size × price` al costo de la posición.
- Cada venta saca costo al precio promedio, no al de venta. Así el costo que queda corresponde a las acciones que todavía tiene.
- Rendimiento total = `valor de mercado / costo restante - 1`.
- Rendimiento diario = `close / previousClose - 1`, como indica el enunciado.

Las órdenes se aplican en orden cronológico (por `datetime` y después por `id`), no en el orden en que vienen de la base.

### Valuación

- El precio de un activo es el `close` de la fecha más reciente en `marketdata`.
- Valor total = cash total + suma del valor de mercado de las posiciones.
- Una posición sin precio (por ejemplo PGR, que no tiene marketdata) se muestra con su cantidad y con valor y rendimiento en `null`. No suma al total, porque no hay forma honesta de valuarla.
- Las posiciones que quedan en 0 no se muestran.

### La posición negativa de BMA

El usuario 1 compró 20 BMA (FILLED) y vendió 30 (FILLED). La otra compra de 60 está en NEW, así que según los datos tiene −10. Lo muestro tal cual: valor de mercado negativo, que sí resta del total, y sin costo promedio ni rendimiento total, porque no tienen sentido. Esconder la posición haría que el portfolio no cierre con las órdenes. Además, con la regla de acciones disponibles, no puede volver a vender BMA hasta tener saldo positivo.

### Órdenes por monto

`size = floor(amount / price)`, con el `close` en MARKET o el precio límite en LIMIT. No se admiten fracciones. Si el monto no alcanza para una acción, la orden queda REJECTED con tamaño 0.

### Error de input vs. orden rechazada

Separé dos casos:

- **El pedido está mal formado** o no se puede procesar: responde 400 o 404 y **no se guarda nada**. Es el caso de un body inválido, una LIMIT sin precio, una MARKET con precio, `size` y `amount` juntos (o ninguno), un usuario o instrumento inexistente, operar ARS o una MARKET sobre un activo sin precio.
- **El pedido es válido pero el mercado lo rechaza**: se guarda en `orders` como REJECTED y responde 201. Es el caso de no tener pesos, no tener acciones o un monto menor a una acción. El enunciado lo pide así explícitamente.

| `code` | Status | Cuándo |
|---|---|---|
| `PRICE_REQUIRED` | 400 | LIMIT sin precio |
| `PRICE_NOT_ALLOWED` | 400 | MARKET con precio |
| `SIZE_OR_AMOUNT` | 400 | `size` y `amount` juntos, o ninguno |
| `NO_MARKET_PRICE` | 400 | MARKET sobre un activo sin marketdata |
| `INSTRUMENT_NOT_TRADABLE` | 400 | Comprar o vender ARS |
| `NOT_FOUND` | 404 | Usuario, instrumento u orden inexistente |
| `ORDER_NOT_CANCELLABLE` | 409 | Cancelar una orden que no está en NEW |

Una MARKET con precio la rechazo en lugar de ignorar el precio: si lo ignoro, el usuario puede creer que se respetó.

En las REJECTED la respuesta incluye `rejectionReason` (`INSUFFICIENT_FUNDS`, `INSUFFICIENT_SHARES`, `AMOUNT_BELOW_PRICE`). No lo guardo porque `orders` no tiene una columna para eso y no quise cambiar el esquema solo por esto.

### Concurrencia

Crear una orden es leer el saldo, decidir y escribir. Si dos pedidos del mismo usuario llegan juntos, los dos pueden leer el mismo saldo y gastar la misma plata. Para evitarlo, todo corre en una transacción que arranca con `SELECT ... FROM users WHERE id = $1 FOR UPDATE`. Las órdenes de un mismo usuario se serializan y las de distintos usuarios no se bloquean entre sí. La cancelación bloquea la fila de la orden, así que dos cancelaciones simultáneas no pueden pisarse.

Hay tests que lo prueban: diez compras en paralelo que juntas superan el saldo terminan en una FILLED y nueve REJECTED.

### Plata

Los precios están en `NUMERIC(10,2)` y `pg` los devuelve como string. Todos los cálculos los hago con `decimal.js`, que es una librería de decimales de precisión arbitraria, para no tener errores de redondeo de punto flotante. En las respuestas los montos van como string con dos decimales, y los porcentajes también, con dos decimales. El body de las órdenes acepta como máximo dos decimales y un precio que entre en `NUMERIC(10,2)`. Si no, la base fallaría con un error 500.

### Búsqueda

- `ILIKE` sobre ticker y nombre. El ARS queda afuera porque es la moneda, no un activo.
- Los caracteres `%`, `_` y `\` que manda el usuario se escapan, así que buscar `%` busca ese carácter literal y no matchea todo.
- El orden es: primero el ticker exacto, después los tickers que empiezan con lo buscado y al final el resto.
- El último precio sale de un `LEFT JOIN LATERAL` que usa el índice `(instrumentid, date DESC)` y solo se calcula para los activos encontrados.

### Cancelación sin autenticación

No hay auth, así que si `PATCH /orders/:id/cancel` aceptara solo el id, cualquiera podría cancelar órdenes ajenas probando números. Por eso pide el `userId` y busca la orden por id y usuario. Si la orden es de otro usuario, responde 404, igual que si no existiera.

### Cambios en la base

No toqué el esquema. Solo agregué tres índices (`db/init/02_indexes.sql`), porque la base solo tenía las primary keys:

- `orders (userid, status)`: el portfolio y cada orden nueva filtran las órdenes de un usuario por estado.
- `orders (instrumentid)`: la foreign key no tenía índice.
- `marketdata (instrumentid, date DESC)`: para traer el último precio de cada activo sin recorrer la tabla.

Con los datos actuales Postgres igual elige leer la tabla completa, porque son pocas filas. Los índices sirven cuando hay volumen.

## Lo que encontré en los datos

- El README del challenge dice que `marketdata` tiene `datetime`, pero la columna es `date`.
- Las columnas se crearon sin comillas, así que Postgres las guarda en minúscula (`instrumentid`, `previousclose`). El mapeo a camelCase está en los repositories.
- CASH_IN y CASH_OUT son órdenes sobre ARS (id 66) con `price = 1` y `size = monto`.
- PGR (3), IRCP (10) y ARS (66) no tienen precios.
- Hay precios de dos días: 13 y 14 de julio de 2023.
- Los usuarios 2, 3 y 4 no tienen órdenes.

Calculé a mano el portfolio del usuario 1 antes de escribir código y lo uso como caso de referencia en los tests:

| | |
|---|---|
| Cash (FILLED) | 1.000.000 − 46.500 + 9.400 − 100.000 − 30.800 − 125.000 + 45.900 = **753.000** |
| Reservado (LIMIT en NEW) | 50 LOMA × 710 + 60 BMA × 1.500 = **125.500** |
| Disponible | **627.500** |
| Posiciones | PAMP 40 · METR 500 · BMA −10 |
| Valor total | 753.000 + 37.034 + 114.750 − 15.028 = **889.756** |

## Arquitectura

```
src/
  main.ts, app.module.ts, app.setup.ts   arranque y configuración HTTP compartida con los tests
  config/        validación de variables de entorno
  db/            pool de conexiones y helper de transacciones
  common/        dinero, errores y filter, pipes, límites, helpers de SQL
  instruments/   búsqueda
  portfolio/
    domain/      cálculo de cash, posiciones y valuación (funciones puras)
  orders/
    domain/      reglas de una orden: precio, tamaño, fondos, estado (funciones puras)
test/            tests funcionales contra Postgres
db/init/         SQL original del challenge e índices
```

Cada módulo tiene controller, service y repository:

- **Controller**: recibe el request, valida el DTO y devuelve la respuesta.
- **Service**: orquesta el caso de uso y maneja la transacción.
- **Repository**: tiene todo el SQL. Es el único lugar que conoce `pg` y los nombres de columnas.
- **Domain**: la lógica de negocio, en funciones puras que no conocen ni Nest ni la base. Se testean sin levantar nada.

El cálculo de cash y tenencias (`portfolio/domain/ledger.ts`) es el mismo que usa la orden para validar fondos, así que el portfolio y la validación no pueden dar números distintos.

### Por qué SQL sin ORM

Lo más delicado del challenge es la transacción con lock al crear una orden, y quería que se viera explícita. Las consultas son pocas y en SQL se leen directo. Todas son parametrizadas.

### Otras decisiones técnicas

- **Variables de entorno**: se validan al arrancar. Si falta `DATABASE_URL` o el `PORT` es inválido, la app no levanta.
- **Validación del body**: rechaza campos desconocidos y no convierte tipos. `"5"` no pasa como número.
- **Seguridad HTTP**: `helmet`, sin el header `x-powered-by`, y el body JSON acepta 10kb como máximo.
- **Errores inesperados**: devuelven un 500 genérico y se loguean del lado del servidor, sin exponer detalles.
- **Pool de conexiones**: tiene un `statement_timeout` de 5 segundos y se cierra ordenadamente al apagar la app.
- **Tests con Nest 12**: Nest 12 se publica como ESM, así que Jest corre con `--experimental-vm-modules`, igual que en la plantilla oficial de Nest.

## Tests

```bash
npm test            # unitarios
npm run test:e2e    # funcionales, con Docker levantado
```

- **Unitarios** (`src/**/*.spec.ts`): cálculo de cash, posiciones, costo promedio y rendimientos con el usuario 1 y casos borde. También las reglas de órdenes, el manejo de dinero, el filter de errores y la validación.
- **Funcionales** (`test/*.e2e-spec.ts`): levantan la app completa contra Postgres. El de órdenes cubre:
  - órdenes MARKET y LIMIT, por cantidad y por monto;
  - rechazos por fondos y por acciones;
  - reservas de cash y de acciones;
  - errores 400 y 404, verificando que no se guarde nada;
  - cancelación;
  - concurrencia.

Los funcionales usan una base separada, `cocos_test`, que se crea sola y se resetea antes de cada test. El helper de reset se niega a correr si el nombre de la base no termina en `_test` o si el host no es local. Así no hay forma de que un test borre la base de desarrollo o una base remota.

## Qué haría con más tiempo

- **Tabla de saldos y posiciones** actualizada en la misma transacción que la orden. Hoy recalculo desde `orders` en cada lectura, lo cual está bien con este volumen pero no escala con usuarios que tienen miles de órdenes. Mantendría `orders` como fuente de verdad y la tabla como caché, con un job de reconciliación.
- **Idempotency key en `POST /orders`**: si el cliente reintenta por un timeout, hoy puede crear la orden dos veces.
- **Ejecución de órdenes LIMIT**: hoy quedan en NEW para siempre, porque el enunciado dice que no hace falta simular el mercado.
- **Paginación** en la búsqueda y un endpoint de historial de órdenes.
- **Índice trigram** (`pg_trgm`) para que el `ILIKE '%...%'` no recorra la tabla con muchos instrumentos.
- **Guardar el motivo de rechazo** en una columna nueva de `orders`.
- **Autenticación**: el `userId` saldría del token y no del request.
- **Observabilidad**: logs estructurados con request id y métricas de latencia.
