# Hotel Operations API & Management Engine

Run PostgreSQL with `docker compose up -d`, create `.env` from `.env.example`, install with `pip install -e .`, then apply `psql "$DATABASE_URL" -f migrations/versions/0001_production_foundation.sql` and start `uvicorn app.main:app --reload`.

When running, the FastAPI server serves both the REST API and the modernized modular frontend directly:
* **Frontend Web App**: `http://localhost:8000/`
* **Interactive API Docs (Swagger UI)**: `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`
* **Trial Balance CSV Export**: `http://localhost:8000/exports/trial-balance.csv?as_at=YYYY-MM-DD`

## Key Architecture Points
* **Concurrency Protection**: The schema protects overlapping active stays with a PostgreSQL `btree_gist` exclusion constraint.
* **Double-Entry Financial Engine**: Journal lines are the sole source for the trial balance; card and gateway receipts debit clearing accounts until a settlement journal moves them to bank.
* **Master Data Import**: `scripts/import_demo.py` imports browser backups into PostgreSQL for reviewed mapping before posting.
* **Modular Frontend**: Built with ES6 modules in `frontend/`, providing an Executive Dashboard, Front Desk Workbench, Room Rack (Tape Chart), Housekeeping, POS, Cashiering, and Financial Statements.
