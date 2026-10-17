# TEMPLATE_PRETTY_NAME

A modern full-stack web application template featuring flexible **SSG** (Static Site Generation), **SSR** (Server-Side Rendering) and **CSR** (Client-Side Rendering) options, built-in HTTPS, PostgreSQL integration, and Vite tooling.

---

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [📦 Getting Started](#-getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Database Setup](#2-database-setup)
  - [3. Environment Configuration](#3-environment-configuration)
  - [4. Local SSL Certificates](#4-local-ssl-certificates)
  - [5. Install Dependencies](#5-install-dependencies)
- [🛠 Development Guide](#-development-guide)
  - [Environment Architecture](#environment-architecture)
  - [Server Features & Proxies](#server-features--proxies)
  - [Frontend Architecture & Vite](#frontend-architecture--vite)
  - [Database Migrations](#database-migrations)
- [🚀 Scripts & Workflows](#-scripts--workflows)
  - [Flags](#flags)
  - [Examples](#examples)

---

## ✨ Features

- **Flexible Rendering:** Choose between SSG, SSR or CSR for your frontend routes.
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

### 5. Install Dependencies

1. Navigate to your selected frontend directory and install packages
    ```bash
    cd fastify_vite
    npm install
    cd ..
    ```
2. Install cargo watch for automatic backend reloading
    ```bash
    cargo install cargo-watch --locked
    ```
3. Grant executable permissions to development scripts
    ```bash
    chmod +x fmt.sh dev.sh build.sh start.sh
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

Routes are automatically created from files inside the `src/pages/` directory. Each page's file extension determines how it is rendered.

##### Rendering Modes

Use one of the following extensions to choose a page's rendering mode:

| Extension | Rendering Mode | Description |
|---|---|---|
| `.ssg.tsx` | Static Site Generation (SSG) | Generates pages at build time. |
| `.ssr.tsx` | Server-Side Rendering (SSR) | Renders pages on the server for each request. |
| `.csr.tsx` | Client-Side Rendering (CSR) | Renders pages in the browser. |

##### Route Mapping

The file structure determines the URL. Directory index files map to the root of their respective directories.

| File Path | URL Route |
|---|---|
| `src/pages/index.ssr.tsx` | `/` |
| `src/pages/contact/index.ssr.tsx` | `/contact/` |
| `src/pages/about.ssg.tsx` | `/about` |
| `src/pages/user/usr-[id].ssr.tsx` | `/user/usr-123` |

*The rendering mode shown in these examples is illustrative. You can choose the appropriate mode for each page.*

##### Dynamic Routes

To create a dynamic route, include a parameter in the filename using square brackets: `[param]`.

For example, `src/pages/user/usr-[id].ssr.tsx` matches URLs such as:

- `/user/usr-123`
- `/user/usr-456`
- `/user/usr-789`

In each case, `id` represents the dynamic part of the URL.

### Database Migrations

This project uses SQLx migrations for PostgreSQL.

#### Migration Files

To create a new reversible migration (with both apply and rollback scripts), run:

```bash
sqlx migrate add -r --source actix_server/migrations <migration_name>
```

For example:

```bash
sqlx migrate add -r --source actix_server/migrations add_users_table
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
sqlx migrate run --source actix_server/migrations
```

Revert the most recently applied reversible migration:

```bash
sqlx migrate revert --source actix_server/migrations
```

SQLx reads the PostgreSQL connection string from `DATABASE_URL`, which can be set in your shell environment or in a local `.env` file:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/database_name
```

---

## 🚀 Scripts & Workflows

| Script | Purpose |
| :--- | :--- |
| `./dev.sh` | Launches the Rust backend and Vite development server with hot reloading. |
| `./fmt.sh` | Formats Rust and frontend code according to project style guidelines. |
| `./build.sh` | Builds the Rust backend in release mode and builds the frontend, including static site generation (SSG). |
| `./start.sh` | Runs the prebuilt Rust executable and frontend production server. **Requires a successful prior execution of `./build.sh`.** |

### Flags

| Script | Flag | Effect |
| :--- | :--- | :--- |
| `./dev.sh`, `./start.sh` | `--log` | Enables Rust logging with `RUST_LOG=info`. |
| `./dev.sh`, `./start.sh` | `--log=LEVEL` | Sets the Rust log level, e.g. `debug`, `trace`, or `warn`. |
| `./build.sh` | `--check`, `-check`, `-c` | Checks the backend and frontend ports and offers to terminate processes occupying them. |
| `./build.sh` | `--yes`, `-y` | Skips interactive confirmations. When combined with `--check`, automatically attempts to free occupied ports. |
| `./dev.sh`, `./fmt.sh`, `./build.sh`, `./start.sh` | `--help`, `-h` | Displays usage information. |

### Examples

```bash
# Start development servers
./dev.sh

# Start development servers with Rust info logging
./dev.sh --log

# Enable detailed Rust debug logging
./dev.sh --log=debug

# Format Rust and frontend code
./fmt.sh

# Build the production backend and frontend
./build.sh

# Check ports before building
./build.sh --check

# Automatically attempt to free occupied ports before building
./build.sh --check --yes

# Start the production services (after building)
./start.sh
```
