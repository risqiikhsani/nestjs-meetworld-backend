# ==========================================
# STAGE 1: Build the application
# ==========================================
FROM node:20-alpine AS builder

# Install pnpm globally
RUN npm i -g pnpm

WORKDIR /usr/src/app

# Copy only workspace/package files first to leverage Docker cache layers
COPY pnpm-lock.yaml package.json ./

# Install all dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build the NestJS application (compiles TS to JS in /dist)
RUN pnpm run build

# Prune devDependencies to keep the production build lean
# (We use a multi-stage copy instead of inline pruning for better efficiency with pnpm)
RUN pnpm prune --prod

# ==========================================
# STAGE 2: Run the application
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy built application and pruned production node_modules from builder stage
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]