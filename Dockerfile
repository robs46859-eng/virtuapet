FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build --workspace=@virtuapet/contracts && npm run build --workspace=@virtuapet/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
RUN addgroup -S virtuapet && adduser -S virtuapet -G virtuapet
COPY --from=build --chown=virtuapet:virtuapet /app/package.json /app/package-lock.json ./
COPY --from=build --chown=virtuapet:virtuapet /app/node_modules ./node_modules
COPY --from=build --chown=virtuapet:virtuapet /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=virtuapet:virtuapet /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=virtuapet:virtuapet /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=virtuapet:virtuapet /app/packages/contracts/dist ./packages/contracts/dist
COPY --chown=virtuapet:virtuapet scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=virtuapet:virtuapet scripts/bootstrap-postgres.mjs ./scripts/bootstrap-postgres.mjs
COPY --chown=virtuapet:virtuapet infra/migrations ./infra/migrations
COPY --chown=virtuapet:virtuapet simulations/denver-mock/cases.json ./simulations/denver-mock/cases.json
COPY --chown=virtuapet:virtuapet simulations/denver-mock/workflow.mjs ./simulations/denver-mock/workflow.mjs
COPY --chown=virtuapet:virtuapet simulations/denver-mock/seed.mjs ./simulations/denver-mock/seed.mjs
USER virtuapet
EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
