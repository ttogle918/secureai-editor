# 🎸 STACK_python_django — Django 특화 보안 패턴
## Python 공통 파일과 함께 로드 | RAG 추가 대상

> **로드 조건:** `from django` 또는 `import django` 또는 `django.db` 감지 시.
> `STACK_common_python.md` 와 **반드시 함께** 로드하세요.

---

## 1️⃣ Django 즉시 CRITICAL

```python
# ── Raw SQL 문자열 조립 ───────────────────────────────
from django.db import connection
with connection.cursor() as c:
    c.execute("SELECT * FROM users WHERE id = " + user_id)         # SQLi
    c.execute(f"SELECT * FROM users WHERE name = '{name}'")        # SQLi
    c.execute("SELECT * FROM orders WHERE user_id = %s" % uid)    # SQLi

User.objects.raw(f"SELECT * FROM auth_user WHERE id = {user_id}") # SQLi
User.objects.extra(where=["id = " + user_id])                     # SQLi

# ── 디버그 모드 프로덕션 노출 ─────────────────────────
# settings.py
DEBUG = True                        # 스택 트레이스 + 소스코드 노출
SECRET_KEY = 'django-insecure-...'  # 기본/약한 시크릿 CRITICAL
SECRET_KEY = 'my-secret'

# ── ALLOWED_HOSTS 미설정 ──────────────────────────────
ALLOWED_HOSTS = ['*']               # 모든 호스트 허용
ALLOWED_HOSTS = []                  # DEBUG=False 시 500 에러

# ── mark_safe() + 사용자 입력 (XSS) ──────────────────
from django.utils.safestring import mark_safe
safe_html = mark_safe(user_input)   # XSS CRITICAL
return mark_safe(f"<div>{comment}</div>")
```

---

## 2️⃣ Django 즉시 HIGH

```python
# ── CSRF 보호 비활성화 ────────────────────────────────
MIDDLEWARE = [
    # 'django.middleware.csrf.CsrfViewMiddleware',  # 주석 처리 = HIGH
]

from django.views.decorators.csrf import csrf_exempt
@csrf_exempt                        # state-changing 뷰에 적용 = HIGH
def payment(request): ...

# ── IDOR — 소유권 검증 없음 ──────────────────────────
def get_order(request, order_id):
    order = Order.objects.get(pk=order_id)  # request.user와 비교 없음
    return JsonResponse(order.to_dict())

# ── Mass Assignment — ModelForm/DRF 전체 허용 ─────────
class UserForm(ModelForm):
    class Meta:
        model = User
        fields = '__all__'          # is_admin, password 등 전체 포함

# ── Django Admin 취약 설정 ────────────────────────────
urlpatterns = [
    path('admin/', admin.site.urls),  # /admin/ 기본 경로 노출
]

# ── 세션 설정 미비 ────────────────────────────────────
SESSION_COOKIE_HTTPONLY = False     # JS 접근 허용
SESSION_COOKIE_SECURE = False       # HTTP 전송 허용
SESSION_COOKIE_SAMESITE = None      # CSRF 취약

# ── 하드코딩 자격증명 ────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'PASSWORD': 'hardcoded_password',   # CRITICAL
    }
}

# ── 파일 업로드 검증 없음 ────────────────────────────
def upload(request):
    f = request.FILES['file']
    with open(f'/uploads/{f.name}', 'wb') as dest:  # 파일명 검증 없음
        for chunk in f.chunks():
            dest.write(chunk)

# ── ORM 우회 Extra/RawSQL ─────────────────────────────
queryset.extra(where=[f"status = '{status}'"])         # HIGH
queryset.extra(select={'custom': f"(SELECT {col})"})   # HIGH
```

---

## 3️⃣ Django 확인 필요 패턴

```python
# ORM 필터 — 파라미터 확인
User.objects.filter(username=username)          # ✅ 안전
User.objects.filter(**{field_name: value})      # ⚠️ field_name이 사용자 입력이면 위험

# DRF Serializer
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'   # ⚠️ is_staff, password 포함 → HIGH
        # ✅ 명시적으로: fields = ['username', 'email', 'bio']
        read_only_fields = ['is_staff', 'is_superuser']

# Django 템플릿 자동이스케이프
{{ user_input }}          # ✅ 자동 이스케이프
{{ user_input|safe }}     # ⚠️ 안전한 데이터인지 확인 필요
{% autoescape off %}      # ⚠️ 자동 이스케이프 비활성화 — 범위 확인
```

---

## 4️⃣ Django 올바른 패턴 (참조)

```python
# ✅ ORM 파라미터 바인딩 (항상 이 방식)
User.objects.filter(id=user_id)
User.objects.filter(username=username, is_active=True)

# ✅ Raw SQL 필요 시 — 파라미터 바인딩
with connection.cursor() as c:
    c.execute("SELECT * FROM users WHERE id = %s", [user_id])
    c.execute("UPDATE users SET name = %s WHERE id = %s", [name, user_id])

User.objects.raw("SELECT * FROM auth_user WHERE id = %s", [user_id])

# ✅ IDOR 방지
from django.shortcuts import get_object_or_404
def get_order(request, order_id):
    order = get_object_or_404(Order, pk=order_id, user=request.user)
    return JsonResponse(order.to_dict())

# ✅ ModelForm — 허용 필드만
class UserUpdateForm(ModelForm):
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name']

# ✅ DRF Serializer 보안
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']
        read_only_fields = ['id', 'is_staff', 'is_superuser', 'date_joined']

# ✅ settings.py 프로덕션 설정
from .base import *
DEBUG = False
ALLOWED_HOSTS = ['myapp.com', 'www.myapp.com']
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'Strict'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True

# ✅ Django Admin 경로 변경
urlpatterns = [
    path('secure-admin-xyz/', admin.site.urls),  # 기본 /admin/ 숨김
]
```

---

## 5️⃣ Django 의존성 특이사항

```
Django < 4.2 LTS    → 보안 지원 종료 확인 필요
djangorestframework → serializer fields 전체 노출 주의
django-debug-toolbar → 프로덕션 절대 사용 금지
Pillow < 10.x       → 이미지 처리 CVE 다수
celery              → task 인자에 사용자 입력 직접 전달 주의 (인젝션)
```
