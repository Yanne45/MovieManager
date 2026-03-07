# 🎬 MovieManager

Desktop application for managing a video file collection (movies & TV series).

Built with **Tauri 2 + Rust + React + TypeScript + SQLite**.

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- Tauri CLI: `cargo install tauri-cli`

## Setup

```bash
cd moviemanager
npm install
cargo tauri dev
```

## Structure

```
moviemanager/
├── src/                        # React frontend
│   ├── lib/tauri.ts            # Typed API wrapper
│   └── styles/globals.css      # Design tokens
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── lib.rs              # Tauri setup + state
│   │   ├── commands/           # API layer (libraries, movies, series, tags, scan)
│   │   ├── db/                 # Connection, models, queries
│   │   └── modules/            # ingestion, filename_parser
│   └── migrations/             # 11 SQL files, 28 tables
├── package.json
└── vite.config.ts
```
