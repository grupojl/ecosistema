# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY realsass-dashboard-front/package.json ./realsass-dashboard-front/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_REAL_BACK_URL
ARG NEXT_PUBLIC_ECOMMERCE_API_URL
ARG NEXT_PUBLIC_STORE_FRONT_URL
ARG NEXT_PUBLIC_SASS_FRONT_URL
ARG NEXT_PUBLIC_SASS_BACK_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_REAL_BACK_URL=$NEXT_PUBLIC_REAL_BACK_URL
ENV NEXT_PUBLIC_ECOMMERCE_API_URL=$NEXT_PUBLIC_ECOMMERCE_API_URL
ENV NEXT_PUBLIC_STORE_FRONT_URL=$NEXT_PUBLIC_STORE_FRONT_URL
ENV NEXT_PUBLIC_SASS_FRONT_URL=$NEXT_PUBLIC_SASS_FRONT_URL
ENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml   ./
COPY packages/                          ./packages/
COPY realsass-dashboard-front/          ./realsass-dashboard-front/
WORKDIR /app/realsass-dashboard-front
RUN /app/node_modules/.bin/next build

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=nextjs:nodejs /app/node_modules                   ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json                   ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages                       ./packages
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/.next ./realsass-dashboard-front/.next
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/public ./realsass-dashboard-front/public
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/package.json ./realsass-dashboard-front/package.json
USER nextjs
EXPOSE 3000
WORKDIR /app/realsass-dashboard-front
CMD ["../node_modules/.bin/next", "start"]
