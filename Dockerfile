# The build output is static files, the same for every CPU, so build them once on the machine
# running the build instead of under emulation for each platform (npm crashes under QEMU on arm64).
# Only the nginx stage below is built per platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI
ARG VITE_DISCORD_SCOPES

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID
ENV VITE_DISCORD_REDIRECT_URI=$VITE_DISCORD_REDIRECT_URI
ENV VITE_DISCORD_SCOPES=$VITE_DISCORD_SCOPES

RUN npm run build


FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]