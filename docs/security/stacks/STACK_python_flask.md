# 🌶️ STACK_python_flask — Flask 특화 보안 패턴
## Python 공통 파일과 함께 로드 | RAG 추가 대상

> **로드 조건:** `from flask` 또는 `import flask` 감지 시.
> `STACK_common_python.md` 와 **반드시 함께** 로드하세요.

---

## 1️⃣ Flask 즉시 CRITICAL

```python
# ── Debug 모드 (프로덕션) ─────────────────────────────
app.run(debug=True)                          # 원격 코드 실행 가능!
app.config['DEBUG'] = True                   # Werkzeug debugger 노출
# Werkzeug interactive debugger = 브라우저에서 Python 코드 실행

# ── 예측 가능한 SECRET_KEY ────────────────────────────
app.secret_key = "dev"
app.secret_key = "secret"
app.config['SECRET_KEY'] = "flask-secret"   # 세션 쿠키 위조 가능

# ── render_template_string + 사용자 입력 (SSTI) ───────
from flask import render_template_string
@app.route('/greet')
def greet():
    name = request.args.get('name')
    return render_template_string(f"Hello {name}!")  # SSTI
    # name = "{{config}}" → Flask config 전체 노출
    # name = "{{''.__class__.__mro__[1].__subclasses__()}}" → RCE

# ── CSRF 보호 전역 비활성화 ───────────────────────────
app.config['WTF_CSRF_ENABLED'] = False       # 전체 CSRF 방어 제거

# ── 소유권 검증 없는 데이터 조회 ─────────────────────
@app.route('/api/orders/<int:order_id>')
@login_required
def get_order(order_id):
    order = Order.query.get(order_id)        # 소유권 검증 없음 → IDOR
    return jsonify(order.to_dict())
```

---

## 2️⃣ Flask 즉시 HIGH

```python
# ── 인증 데코레이터 누락 ──────────────────────────────
@app.route('/api/admin/users')
def list_all_users():                        # @login_required 없음
    return jsonify(User.query.all())

# ── 세션 고정 / 세션 설정 미비 ───────────────────────
app.config['SESSION_COOKIE_HTTPONLY'] = False  # JS 접근 허용
app.config['SESSION_COOKIE_SECURE'] = False    # HTTP 전송 허용
app.config['SESSION_COOKIE_SAMESITE'] = None   # CSRF 취약

# ── jsonify로 전체 모델 반환 ──────────────────────────
@app.route('/api/users/<int:id>')
def get_user(id):
    user = User.query.get(id)
    return jsonify(user.__dict__)            # password_hash 등 전체 포함

# ── Flask-SQLAlchemy에 문자열 연결 쿼리 ──────────────
@app.route('/search')
def search():
    q = request.args.get('q')
    results = db.session.execute(
        f"SELECT * FROM products WHERE name LIKE '%{q}%'"  # SQLi
    )

# ── @csrf.exempt 남용 ────────────────────────────────
@csrf.exempt
@app.route('/api/payment', methods=['POST'])
def payment():                               # 결제 엔드포인트 CSRF 제외
    ...

# ── 파일 업로드 검증 미비 ────────────────────────────
@app.route('/upload', methods=['POST'])
def upload():
    f = request.files['file']
    f.save(os.path.join(UPLOAD_DIR, f.filename))  # 파일명 검증 없음
    # f.filename = "../../etc/cron.d/malicious" 가능

# ── 에러 핸들러 없음 또는 정보 노출 ──────────────────
# @app.errorhandler(500) 없음 → Flask 기본 스택 트레이스 노출
```

---

## 3️⃣ Flask 확인 필요 패턴

```python
# Markup() 사용 확인
from markupsafe import Markup
return Markup(user_input)
# ✅ 신뢰된 HTML 문자열에만 사용해야 함
# 사용자 입력에 적용 시 XSS CRITICAL

# send_file() / send_from_directory() 경로 확인
@app.route('/files/<path:filename>')
def download(filename):
    return send_from_directory(UPLOAD_DIR, filename)
    # ✅ send_from_directory는 경로 검증 내장 (상대적으로 안전)
    # 단, UPLOAD_DIR 자체가 신뢰된 경로인지 확인

# Flask-Login current_user 확인
@app.route('/api/profile/<int:user_id>')
@login_required
def get_profile(user_id):
    # ✅ current_user.id == user_id 비교 있는지 확인
    user = User.query.get(user_id)
    return jsonify(user.to_dict())

# Blueprint 보안 확인
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
# ✅ Blueprint 레벨 before_request에 관리자 권한 검증 있는지 확인
```

---

## 4️⃣ Flask 올바른 패턴 (참조)

```python
# ✅ 환경별 설정 분리
class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]   # 환경 변수 필수
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'Strict'
    WTF_CSRF_ENABLED = True

class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = True

class ProductionConfig(Config):
    DEBUG = False  # 명시적으로 False

app.config.from_object(
    DevelopmentConfig if os.getenv('ENV') == 'dev' else ProductionConfig
)

# ✅ SSTI 방지 — 사용자 입력은 변수로만
@app.route('/greet')
def greet():
    name = request.args.get('name', '')
    return render_template('greet.html', name=name)  # 템플릿 파일 사용
    # 또는 고정 템플릿에 변수 주입
    # return render_template_string("Hello {{ name }}!", name=name)

# ✅ IDOR 방지
@app.route('/api/orders/<int:order_id>')
@login_required
def get_order(order_id):
    order = Order.query.filter_by(
        id=order_id,
        user_id=current_user.id     # 소유권 검증
    ).first_or_404()
    return jsonify(order.to_dict_public())  # 공개 필드만

# ✅ 파일 업로드 안전 처리
from werkzeug.utils import secure_filename
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg'}

@app.route('/upload', methods=['POST'])
@login_required
def upload():
    f = request.files.get('file')
    if not f or '.' not in f.filename:
        abort(400)
    ext = f.filename.rsplit('.', 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        abort(400, "File type not allowed")
    filename = secure_filename(f.filename)    # 경로 조작 문자 제거
    f.save(os.path.join(UPLOAD_DIR, filename))

# ✅ 에러 핸들러
@app.errorhandler(Exception)
def handle_error(e):
    app.logger.error(f"Unhandled: {e}", exc_info=True)
    return jsonify({"error": "Internal server error"}), 500

# ✅ 보안 헤더 (Flask-Talisman 또는 after_request)
@app.after_request
def security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response
```

---

## 5️⃣ Flask 의존성 특이사항

```
Flask < 2.3.0         → 알려진 세션 보안 이슈
Flask-WTF < 1.1.0     → CSRF 구현 취약점 존재
Flask-Login           → remember_me 쿠키 시크릿 확인 필요
Flask-SQLAlchemy      → ORM 사용해도 text() raw 쿼리 조심
Jinja2 < 3.1.3        → SSTI 취약점 (CVE-2024-56201)
Werkzeug < 3.0.3      → Path Traversal (CVE-2024-34069)
```
