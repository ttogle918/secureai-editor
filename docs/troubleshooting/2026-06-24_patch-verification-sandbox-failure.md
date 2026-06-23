# 패치검증 샌드박스 항상 FAILED 트러블슈팅

**날짜**: 2026-06-24
**브랜치**: `fix/sprint14-runtime-defects` (커밋 `65e356d` 포함)
**관련 커밋**: `65e356d`

---

## 이슈 — 패치검증(patch_verify)이 항상 FAILED 상태로 반환

### 증상

TASK-1402에서 패치검증 단계가 항상 `status=FAILED`를 반환. 단위테스트는 mock GitHub이라 통과하나 실 사용 시 Verified 상태에 도달하지 못함.

로그:
```
[patch_verify_node] Running: python /app/agent/sandbox/patch_test_runner.py ...
[sandbox_runner] docker run -i --read-only --net dast-isolated-net ... secureai-patch-verify:latest
<container> /bin/sh: pip: not found
<container> /bin/sh: cannot create /tmp/...: Read-only file system
exit code: 127
```

---

## 원인 분석

**3중 원인**:

1. **pytest 선설치 부재**: 컨테이너 이미지에 pytest가 없음. `pip install pytest`로 설치 시도하나:
   - `--read-only` 플래그로 site-packages 쓰기 불가
   - 애초에 `/tmp`도 읽기전용 마운트 → `/tmp/pylibs` 폴백도 불가

2. **PyPI 도달 불가**: `dast-isolated-net` 네트워크는 보안 격리용(DAST 대상 바이너리 격리)
   - 컨테이너 내부에서 외부 인터넷(PyPI) 접근 불가
   - 따라서 런타임 `pip install` 원천 불가능

3. **파이프 종료코드 손실**: `pip install ... | tail -1` 패턴이 stderr/stdout 분리로 실패를 가림:
   ```bash
   pip install pytest 2>&1 | tail -1
   # 파이프가 pipe의 좌측 종료코드를 무시 (오른쪽 tail의 코드만 반환)
   ```
   → 실제 pip 실패를 탐지하지 못하고 진행, 런타임에 import 오류

---

## 해결

**3단계 수정**:

### 1. pytest 선설치 이미지 도입

신규 `Dockerfile.patch-verify` 생성:
```dockerfile
FROM python:3.12-slim

RUN pip install pytest pytest-cov --no-cache-dir

COPY agent/sandbox/patch_test_runner.py /app/patch_test_runner.py
COPY agent/sandbox/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt --no-cache-dir

WORKDIR /app
ENTRYPOINT ["python", "patch_test_runner.py"]
```

빌드 (CI/로컬):
```bash
cd apps/ai_engine
docker build -f agent/sandbox/Dockerfile.patch-verify -t secureai-patch-verify:latest .
```

이 이미지를 `patch_test_runner.py`에서 기본값으로 사용:
```python
IMAGE_NAME = "secureai-patch-verify:latest"
```

### 2. 폴백: tmpfs 쓰기 + 동적 import

혹시 이미지 빌드 실패 시 대비용 폴백 (권장하지 않음, last-resort):
```python
# patch_test_runner.py
try:
    import pytest
except ImportError:
    import subprocess
    subprocess.run([
        "pip", "install", "--target=/tmp/pylibs",
        "pytest", "pytest-cov"
    ], check=True)
    sys.path.insert(0, "/tmp/pylibs")
    import pytest
```

`/tmp`는 tmpfs(메모리 파일시스템)라 `--read-only` 마운트에서도 쓰기 가능.

### 3. 종료코드 명시적 캡처

`patch_test_runner.py` 및 호출부 (`runner.py`):
```bash
set -e  # 파이프 내 첫 실패에서 종료
python /app/agent/sandbox/patch_test_runner.py
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "Patch verification failed with exit code $EXIT_CODE" >&2
    exit $EXIT_CODE
fi
```

---

## 재현 및 검증

### 전제 (선행조건)
```bash
# 1. 이미지 빌드
cd apps/ai_engine
docker build -f agent/sandbox/Dockerfile.patch-verify -t secureai-patch-verify:latest .

# 2. 격리 네트워크 생성
docker network create --driver bridge dast-isolated-net

# 3. 테스트: pytest가 포함된 이미지 확인
docker run --rm secureai-patch-verify:latest python -c "import pytest; print(f'pytest {pytest.__version__}')"
# 출력: pytest X.Y.Z
```

### 단위테스트 실행
```bash
cd apps/ai_engine
pytest tests/agent/test_patch_test_runner.py -v
```

예상 결과: ✅ 모든 케이스 PASSED

---

## 추가 참고

- **why --read-only?** 샌드박스 보안: 악의 테스트 코드가 호스트 파일 변조 방지
- **why dast-isolated-net?** 네트워크 격리: 테스트 중 실 취약 서비스 탈출 방지
- **폴백 언제 쓸까?** 예외상황: CI/로컬에서 Dockerfile 빌드 실패 + 긴급 테스트 필요 시. 프로덕션에서는 항상 선설치 이미지 사용.
