# LSpot Restaurant Manager (LRM) — Deployment & DevOps

## 1. Environment Architecture
- **Operating Environment**: Ubuntu Linux VPS / Hostinger VPS / Docker Compose
- **Database**: PostgreSQL 16+
- **Reverse Proxy**: Nginx with SSL/TLS (Certbot / Let's Encrypt)
- **Process Manager**: PM2 or Docker Compose daemon
- **Object Storage**: Local disk storage mounted securely or S3-compatible storage for receipts, invoices, and photos

## 2. Docker Compose Deployment
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: lspot_postgres
    environment:
      POSTGRES_DB: lspot_db
      POSTGRES_USER: lspot_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.api
    container_name: lspot_api
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://lspot_user:${DB_PASSWORD}@postgres:5432/lspot_db
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3001
    depends_on:
      - postgres
    ports:
      - "3001:3001"
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.web
    container_name: lspot_web
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

## 3. Database Migration & Seed Procedures
1. Run migrations: `pnpm --filter @lspot/database db:deploy`
2. Seed initial data (The LSpot Restaurant, Manyama Branch, Roles, Users, Zambian Menu items): `pnpm --filter @lspot/database db:seed`
