from __future__ import annotations
import aiosqlite
import json
import os
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(os.environ.get("VOXSHIFT_DATA_DIR", Path.home() / ".voxshift")) / "voxshift.db"


async def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL DEFAULT 'local_import',
                file_path TEXT NOT NULL,
                index_path TEXT,
                avatar TEXT NOT NULL DEFAULT '🎤',
                category TEXT NOT NULL DEFAULT 'Custom',
                added_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS training_jobs (
                id TEXT PRIMARY KEY,
                model_name TEXT NOT NULL,
                total_epochs INTEGER NOT NULL,
                current_epoch INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL
            );
        """)
        await db.commit()


async def get_all_models() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM models ORDER BY added_at DESC") as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def insert_model(model: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO models (id, name, source_type, file_path, index_path, avatar, category, added_at) "
            "VALUES (:id, :name, :source_type, :file_path, :index_path, :avatar, :category, :added_at)",
            model
        )
        await db.commit()


async def delete_model(model_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM models WHERE id = ?", (model_id,))
        await db.commit()


async def get_setting(key: str) -> Optional[Any]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM app_settings WHERE key = ?", (key,)) as cur:
            row = await cur.fetchone()
            if row is None:
                return None
            return json.loads(row[0])


async def set_setting(key: str, value: Any) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            (key, json.dumps(value))
        )
        await db.commit()


async def get_all_settings() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT key, value FROM app_settings") as cur:
            rows = await cur.fetchall()
            return {r["key"]: json.loads(r["value"]) for r in rows}


async def upsert_training_job(job: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO training_jobs "
            "(id, model_name, total_epochs, current_epoch, status, started_at) "
            "VALUES (:id, :model_name, :total_epochs, :current_epoch, :status, :started_at)",
            job
        )
        await db.commit()


async def update_training_job(job_id: str, current_epoch: int, status: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE training_jobs SET current_epoch = ?, status = ? WHERE id = ?",
            (current_epoch, status, job_id)
        )
        await db.commit()
