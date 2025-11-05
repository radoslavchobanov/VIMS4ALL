FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Ensure Vite builds for root path; if you host elsewhere, set BASE via ARG/ENV
ARG VITE_BASE=/
ENV BASE_URL=$VITE_BASE
RUN npm run build

# --- runtime stage ---
FROM nginx:1.27-alpine

# Copy our own nginx config (no sed hacks)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: run on 8080 as non-root
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
