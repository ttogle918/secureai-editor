"""SecureAI webhook 데모용 의도적 취약 코드 (PR 자동분석 시연)."""
import os
import sqlite3
import subprocess

from flask import Flask, request

app = Flask(__name__)


@app.route("/user")
def get_user():
    uid = request.args.get("id")
    conn = sqlite3.connect("app.db")
    # [취약] SQL Injection — 사용자 입력을 문자열 연결로 쿼리 조립
    query = "SELECT * FROM users WHERE id = '" + uid + "'"
    return str(conn.execute(query).fetchall())


@app.route("/ping")
def ping():
    host = request.args.get("host")
    # [취약] Command Injection — shell=True + 사용자 입력 직접 전달
    return subprocess.check_output("ping -c 1 " + host, shell=True)


# [취약] 하드코딩된 시크릿
AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE"
API_TOKEN = "ghp_hardcodedTokenShouldNeverBeCommitted1234"


@app.route("/read")
def read_file():
    name = request.args.get("name")
    # [취약] Path Traversal — 사용자 입력으로 경로 조립
    with open("/data/" + name) as f:
        return f.read()


# [취약] 안전하지 않은 역직렬화
import pickle
def load(data):
    return pickle.loads(data)  # nosec false-positive 유도
