
# ==========================================
# ETAPA 1: BUILD
# ==========================================

FROM node:22-bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Copia o schema e a configuração do Prisma
COPY prisma ./prisma
COPY prisma.config.ts ./

# Instala as dependências e gera o Prisma Client
RUN mkdir -p src \
    && DATABASE_URL="mysql://cifrawealth:cifrawealth@mysql:3306/cifrawealth" npm ci

# Copia o restante do projeto
COPY . .

# Gera o Prisma Client, compila e remove dependências de desenvolvimento
RUN DATABASE_URL="mysql://cifrawealth:cifrawealth@mysql:3306/cifrawealth" npm run prisma:generate \
    && npm run build \
    && npm prune --omit=dev


# ==========================================
# ETAPA 2: PRODUÇÃO
# ==========================================

FROM node:22-bookworm-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copia somente os componentes necessários
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated/prisma ./src/generated/prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["node", "dist/server.js"]
