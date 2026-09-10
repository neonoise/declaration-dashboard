"""Transactional storage. Only token digests and salted password hashes are persisted."""
from contextlib import contextmanager
from pathlib import Path
import sqlite3
import json
import hashlib
import hmac
import secrets
import time
from model import initial_state

def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def password_hash(value: str) -> str:
    salt=secrets.token_hex(16)
    hashed=hashlib.scrypt(value.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
    return salt+':'+hashed

def password_matches(value: str, stored: str) -> bool:
    try:
        salt,expected=stored.split(':')
        actual=hashlib.scrypt(value.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
        return hmac.compare_digest(actual,expected)
    except (ValueError,TypeError): return False

class Store:
    def __init__(self,directory: str):
        self.root=Path(directory);self.root.mkdir(parents=True,exist_ok=True)
        self.path=self.root/'declaration.sqlite3'
        with self.connect() as db:
            db.executescript('''
             PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','member')), active INTEGER NOT NULL DEFAULT 1);
             CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, csrf TEXT NOT NULL, expires REAL NOT NULL);
             CREATE TABLE IF NOT EXISTS invites(id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, expires REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0);
             CREATE TABLE IF NOT EXISTS board(id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated TEXT);
             CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, detail TEXT NOT NULL, metrics TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, goal_id TEXT NOT NULL, text TEXT NOT NULL, created TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS rate_limits(key TEXT NOT NULL, at REAL NOT NULL);
             CREATE INDEX IF NOT EXISTS rate_key ON rate_limits(key,at);
             CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            ''')
            db.execute('INSERT OR IGNORE INTO board(id,state) VALUES(1,?)',(json.dumps(initial_state(),ensure_ascii=False),))
        try: self.path.chmod(0o600)
        except OSError: pass
    @contextmanager
    def connect(self):
        conn=sqlite3.connect(self.path,timeout=15)
        conn.row_factory=sqlite3.Row
        conn.execute('PRAGMA busy_timeout=15000')
        try:
            with conn: yield conn
        finally: conn.close()
    def has_owner(self):
        with self.connect() as db:
            return bool(db.execute("SELECT 1 FROM users WHERE role='owner'").fetchone())
    def limited(self,key: str,limit=12,seconds=600) -> bool:
        t=time.time()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM rate_limits WHERE at<?',(t-3600,))
            n=db.execute('SELECT count(*) FROM rate_limits WHERE key=? AND at>?',(key,t-seconds)).fetchone()[0]
            if n>=limit: return True
            db.execute('INSERT INTO rate_limits(key,at) VALUES(?,?)',(key,t))
            return False
