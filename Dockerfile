# syntax=docker/dockerfile:1

# ============================================================================
# Civitas Orbita - image multi-etapes
#   - build : compile l'app (Vite + tsc)
#   - dev   : serveur de developpement Vite avec HMR
#   - prod  : sert les fichiers statiques via Nginx
# ============================================================================

# --- Etape commune : dependances -------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Etape build (production) ----------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build

# --- Etape developpement (HMR) ---------------------------------------------
FROM deps AS dev
COPY . .
EXPOSE 5173
# --host 0.0.0.0 pour etre accessible depuis l'exterieur du conteneur.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Etape production (Nginx) ----------------------------------------------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
