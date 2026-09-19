# TEMPLATE_PRETTY_NAME

![Build Status](https://github.com/TEMPLATE_OWNER/TEMPLATE_NAME/actions/workflows/build.yml/badge.svg)
![Test Status](https://github.com/TEMPLATE_OWNER/TEMPLATE_NAME/actions/workflows/test.yml/badge.svg)

A modern full-stack web application template featuring flexible **SSR** (Server-Side Rendering) and **CSR** (Client-Side Rendering) options, built-in HTTPS, PostgreSQL integration, and Vite tooling.

---

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [📦 Getting Started](#-getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Database Setup](#2-database-setup)
  - [3. Environment Configuration](#3-environment-configuration)
  - [4. Local SSL Certificates](#4-local-ssl-certificates)
  - [5. Choose Architecture & Install Dependencies](#5-choose-architecture--install-dependencies)
- [🛠 Development Guide](#-development-guide)
  - [Environment Architecture](#environment-architecture)
  - [Server Features & Proxies](#server-features--proxies)
  - [Frontend Architecture & Vite](#frontend-architecture--vite)
  - [Database Migrations](#database-migrations)
- [🚀 Scripts & Workflows](#-scripts--workflows)
  - [Flags](#flags)

---

## ✨ Features

- **Flexible Rendering:** Choose between SSR (`fastify_vite_ssr`) or CSR (`vite_csr`) for your frontend architecture.
- **Secure Local Development:** HTTPS enabled out-of-the-box via `mkcert` and secure cookie-based session management.
- **Environment Isolation:** Multi-tiered environment variable structure targeting client, public, and server domains.
- **Built-in i18n:** Clean translation folder layout using namespace-based JSON structures.
- **File-Based Routing:** Simple file and directory routing conventions with dynamic parameter support (`[param]`).

---

## ⚙️ Prerequisites

Ensure you have the following installed on your development machine:

- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Node.js](https://nodejs.org/) (with `npm`)
- [Rust & Cargo](https://www.rust-lang.org/)
- [SQLx CLI](https://github.com/transact-rs/sqlx/blob/main/sqlx-cli/README.md) (for database migrations)
- [mkcert](https://github.com/FiloSottile/mkcert) (for local HTTPS setup)

---

## 📦 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/TEMPLATE_OWNER/TEMPLATE_NAME.git
cd TEMPLATE_NAME
```

### 2. Database Setup

#### Step A: Create User
You can set up your PostgreSQL database user via the interactive shell or command line:

**Option 1: SQL Shell (`psql`)**
```bash
sudo -u postgres psql
```
```sql
/* Creates a new user with password and database creation privileges */
CREATE USER my_username WITH PASSWORD 'my_password' CREATEDB;

/* Grants schema lookup and creation permissions on the public schema */
GRANT USAGE, CREATE ON SCHEMA public TO my_username;

/* Verify user creation and exit */
\du
\q
```

**Option 2: Interactive Shell CLI**
```bash
sudo -u postgres createuser --interactive --pwprompt
```

#### Step B: Create Database
Run the following CLI command to create the project database assigned to your user:

```bash
sudo -u postgres createdb MY_DB_NAME -O my_username
```

> **Note:** If you need to drop the database at any point during development, run:
> ```bash
> sudo -u postgres dropdb MY_DB_NAME
> ```

### 3. Environment Configuration

Copy `.env.example` to create your initial `.env` file, then auto-generate a secure `SESSION_SECRET`:

```bash
cp .env.example .env

# Remove existing SESSION_SECRET key (if present) and append a newly generated secure token
sed -i '/^SESSION_SECRET=/d' .env
echo "SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> .env
```

### 4. Local SSL Certificates

This project requires self-signed SSL certificates for local HTTPS development. Generate them using `mkcert` in the project root:

```bash
mkcert -install
mkcert -key-file key.pem -cert-file cert.pem 127.0.0.1 localhost
```

### 5. Choose Architecture & Install Dependencies

Decide whether you want **Server-Side Rendering (SSR)** or **Client-Side Rendering (CSR)**:

- For **CSR**, delete the `fastify_vite_ssr` directory.
- For **SSR**, delete the `vite_csr` directory.

#### Install Dependencies & Tooling
```bash
# 1. Navigate to your selected frontend directory and install packages
cd fastify_vite_ssr # or: cd vite_csr
npm install
cd ..

# 2. Install cargo watch for automatic backend reloading
cargo install cargo-watch --locked

# 3. Grant executable permissions to development scripts
# For SSR:
chmod +x fmt_ssr.sh dev_ssr.sh build_ssr.sh start_ssr.sh
# For CSR:
chmod +x fmt_csr.sh dev_csr.sh build_csr.sh start_csr.sh

# (Optional) Rename your target scripts to drop the '_csr' or '_ssr' suffix:
# mv dev_ssr.sh dev.sh
```

---

## 🛠 Development Guide

### Environment Architecture

Your `.env` file is split into three primary variable scopes:

| Scope | Prefix | Visibility | Description |
| :--- | :--- | :--- | :--- |
| **Vite** | `VITE_` | Client / Build | Variables consumed directly by Vite configuration and plugins. |
| **Public** | `PUBLIC_` | Client & Server | Non-sensitive shared data (e.g., public hostname, port). |
| **Server** | *None* | Server Only | Sensitive runtime secrets ignored by the frontend bundler. |

### Server Features & Proxies

- **Security & HTTPS:** The server strictly uses `https://` with encrypted cookie session handling. (JWT authentication can be integrated if required by your application context).
- **Reverse Proxy Support:** Includes a `TrustedProxies` state handler for deployments behind Load Balancers or CDNs to guarantee accurate `X-Forwarded-*` header parsing.

### Frontend Architecture & Vite

#### Assets
Place static files inside the `public/` folder.

#### Internationalization (i18n)
Translations are stored within `public/locales/` following a namespace format:
```
public/locales/{{namespace}}/{{language}}.json
```

#### File-Based Routing
Pages reside in `src/pages/`. Directory index files map directly to route roots:

| File Path | Mapped URL Route |
| :--- | :--- |
| `src/pages/index.tsx` | `/` |
| `src/pages/contact/index.tsx` | `/contact/` |
| `src/pages/user/usr-[id].tsx` | `/user/usr-123` *(Dynamic Param)* |

Dynamic parameters are designated using the `[param]` syntax within filenames.

### Database Migrations

This project uses SQLx migrations for PostgreSQL.

#### Migration Files

To create a new reversible migration (with both apply and rollback scripts), run:

```bash
sqlx migrate add -r <migration_name>
```

For example:

```bash
sqlx migrate add -r add_users_table
```

This creates two files in `migrations/`:

```bash
<timestamp>_add_users_table.up.sql
<timestamp>_add_users_table.down.sql
```

- Put the schema change in the `.up.sql` file.
- Put the rollback operation in the `.down.sql` file.

Example:

```sql
-- <timestamp>_add_users_table.up.sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);
```

```sql
-- <timestamp>_add_users_table.down.sql
DROP TABLE users;
```

#### Migrations & Rollbacks

The project will run all migrations itself, but it's possible to run it yourself instead of running the server.

Apply pending migrations:

```bash
sqlx migrate run
```

Revert the most recently applied reversible migration:

```bash
sqlx migrate revert
```

SQLx reads the PostgreSQL connection string from `DATABASE_URL`, which can be set in your shell environment or in a local `.env` file:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/database_name
```

---

## 🚀 Scripts & Workflows

| Script | Purpose |
| :--- | :--- |
| `./dev.sh` | Launches hot-reloading development environment for real-time changes. |
| `./fmt.sh` | Formats code according to project style guidelines. |
| `./build.sh` | Compiles assets and builds the application for production. |
| `./start.sh` | Executes the built production bundle *(Requires prior execution of `./build.sh`)*. |

### Flags

| Script | Flag | Effect |
| :--- | :--- | :--- |
| `./dev.sh` | `--log` | Sets `RUST_LOG=debug` for the actix server. Omit for no logging output. |
| `./build.sh` | `--release` | Builds the actix server in release mode (`cargo build --release`). Omit for a debug build. |

**Examples:**
```bash
./dev.sh --log          # dev server with debug logging
./build.sh --release    # production release build
```
