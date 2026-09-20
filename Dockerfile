FROM node:22-alpine
ENV PORT=5556 HOST=0.0.0.0 NODE_ENV=production NODE_OPTIONS=--max-old-space-size=256
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.js lib.js ./
COPY public ./public
EXPOSE 5556
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5556)+'/api/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || exit 1
CMD ["node", "server.js"]