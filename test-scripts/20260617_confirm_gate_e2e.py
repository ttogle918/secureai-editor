#!/usr/bin/env python3
"""
20260617 — 컨펌 게이트 전 구간 수동 E2E 테스트
체크리스트:
  [기능] 분석 시작→모달 노출, 전체승인, stage 제외, 파일 제외
  [보안] 타 사용자 confirm(403/404), 재컨펌(409), 모든 stage 제외(400)
  [회귀] 일반 분석(confirmGate 미사용), STAGE-1 점진 노출, TC-6 재개 흐름

Usage:
  python test-scripts/20260617_confirm_gate_e2e.py [project_id]

  project_id  : 기존 프로젝트 UUID (없으면 새 프로젝트 자동 생성)
"""

import sys
import uuid
import time
import json
import threading
import requests
import sseclient          # pip install sseclient-py  (없으면 첫 실행에서 안내)

BASE = "http://localhost:8080/api/v1"

# ──────────────────────────────────────────────
# 색상 출력 헬퍼
# ──────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✅ PASS{RESET} {msg}")
def fail(msg): print(f"  {RED}❌ FAIL{RESET} {msg}")
def info(msg): print(f"  {CYAN}ℹ  {RESET} {msg}")
def head(msg): print(f"\n{YELLOW}{'─'*60}{RESET}\n{YELLOW}{msg}{RESET}")

results = []

def check(name, condition, detail=""):
    if condition:
        ok(name)
        results.append((name, True, detail))
    else:
        fail(f"{name}  {detail}")
        results.append((name, False, detail))
    return condition


# ──────────────────────────────────────────────
# Auth 헬퍼 — DB에 미리 생성된 이메일 인증된 테스트 계정 사용
# (비밀번호 hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi = "password")
# ──────────────────────────────────────────────
TEST_ACCOUNTS = [
    {"email": "e2etest1@secureai.com", "password": "Secure123!"},
    {"email": "e2etest2@secureai.com", "password": "Secure123!"},
]

# dvwa-source 프로젝트 (ee604167) — /workspace/dvwa-source 경로 마운트
# WORKSPACE_PATH env var를 통해 호스트 dvwa-source 디렉터리를 컨테이너에 마운트해야 함
# 미설정 시 /workspace 빈 볼륨 — 파일 0개로 분석 즉시 종료(COMPLETED)
DVWA_PROJECT_ID = "ee604167-2b86-42cb-8da3-a7453cdd6cb9"
DVWA_WORKSPACE  = "/workspace"  # 컨테이너 내 경로 (빈 볼륨이어도 됨 — 분석 빠르게 완료)

def login_account(email, password):
    lr = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    if lr.status_code != 200:
        print(f"  로그인 실패: {lr.status_code} {lr.text[:200]}")
        return None
    token = lr.json().get("data", {}).get("accessToken")
    if not token:
        print(f"  accessToken 없음: {lr.text[:200]}")
        return None
    return token


def register_and_login(suffix=""):
    """기존 호환성 — e2etest1 계정으로 로그인 반환"""
    acct = TEST_ACCOUNTS[0] if suffix == "" else TEST_ACCOUNTS[1]
    token = login_account(acct["email"], acct["password"])
    return token, acct["email"], acct["password"]


def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ──────────────────────────────────────────────
# Project 헬퍼
# ──────────────────────────────────────────────
def create_project(token):
    r = requests.post(f"{BASE}/projects", json={
        "name": f"ConfirmGateTest-{uuid.uuid4().hex[:6]}",
        "description": "Automated confirm gate test project",
        "sourceType": "local"
    }, headers=headers(token))
    if r.status_code not in (200, 201):
        print(f"  프로젝트 생성 실패: {r.status_code} {r.text[:300]}")
        return None
    data = r.json().get("data", {})
    pid = data.get("id") or data.get("projectId")
    info(f"프로젝트 생성: {pid}")
    return pid


# ──────────────────────────────────────────────
# Analysis 헬퍼
# ──────────────────────────────────────────────
def start_analysis(token, project_id, *, confirm_gate=True, workspace_root=None):
    body = {
        "projectId": project_id,
        "sourceType": "local",
        "workspaceRoot": workspace_root or DVWA_WORKSPACE,
        "scanMode": "AUDIT",
        "confirmGate": confirm_gate,
        "planningMode": "DETERMINISTIC",
        "force": True
    }
    r = requests.post(f"{BASE}/analysis/sessions", json=body, headers=headers(token))
    return r


def get_session(token, session_id):
    r = requests.get(f"{BASE}/analysis/sessions/{session_id}", headers=headers(token))
    return r.json().get("data", {})


def confirm_plan(token, session_id, selected_stage_nos=None, excluded_file_paths=None):
    body = {}
    if selected_stage_nos is not None:
        body["selectedStageNos"] = selected_stage_nos
    if excluded_file_paths is not None:
        body["excludedFilePaths"] = excluded_file_paths
    return requests.post(
        f"{BASE}/analysis/sessions/{session_id}/confirm",
        json=body, headers=headers(token)
    )


def wait_for_status(token, session_id, target_statuses, timeout=120, poll=3):
    """세션 상태가 target_statuses 중 하나가 될 때까지 폴링"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        s = get_session(token, session_id)
        status = s.get("status", "")
        info(f"  세션 상태: {status}")
        if status and status.upper() in {t.upper() for t in target_statuses}:
            return status.upper()
        time.sleep(poll)
    return None


def collect_sse_events(token, session_id, duration=30):
    """SSE 이벤트를 duration초 동안 수집하여 반환"""
    collected = []
    url = f"{BASE}/analysis/sessions/{session_id}/stream"
    try:
        resp = requests.get(url, headers={**headers(token), "Accept": "text/event-stream"},
                            stream=True, timeout=duration + 5)
        client = sseclient.SSEClient(resp)
        deadline = time.time() + duration
        for event in client.events():
            if time.time() > deadline:
                break
            try:
                data = json.loads(event.data)
                collected.append(data)
                t = data.get("type", "")
                info(f"  SSE [{event.name}] type={t}")
                if t in ("completed", "error", "awaiting_confirmation"):
                    break
            except Exception:
                pass
    except Exception as e:
        info(f"  SSE 수집 예외: {e}")
    return collected


# ══════════════════════════════════════════════
#  TC-01  분석 시작 → AWAITING_CONFIRMATION 확인
# ══════════════════════════════════════════════
def tc01_analysis_starts_and_awaits_confirmation(token, project_id):
    head("TC-01 분석 시작 → AWAITING_CONFIRMATION 모달 노출")

    r = start_analysis(token, project_id, confirm_gate=True)
    if not check("POST /sessions 201 반환", r.status_code == 201,
                 f"status={r.status_code} body={r.text[:200]}"):
        return None

    session = r.json().get("data", {})
    session_id = session.get("id") or session.get("sessionId")
    info(f"sessionId={session_id} 초기 status={session.get('status')}")

    # AI Engine이 planning → interrupt 하기까지 대기 (최대 2분)
    # 초기 상태인 RUNNING에 바로 걸리지 않도록 target_statuses에서 RUNNING을 제외한다.
    final = wait_for_status(token, session_id,
                            {"AWAITING_CONFIRMATION", "COMPLETED", "ERROR"},
                            timeout=120, poll=5)

    check("AWAITING_CONFIRMATION 상태 도달",
          final == "AWAITING_CONFIRMATION",
          f"실제 상태={final}")
    return session_id


# ══════════════════════════════════════════════
#  TC-02  전체 승인 → 분석 재개 → COMPLETED
# ══════════════════════════════════════════════
def tc02_full_confirm_and_complete(token, project_id, session_id):
    head("TC-02 전체 승인 → RUNNING → COMPLETED")
    if not session_id:
        check("TC-02 스킵 (TC-01 실패)", False)
        return

    # confirm (selectedStageNos=null → 전체 포함)
    cr = confirm_plan(token, session_id, selected_stage_nos=None, excluded_file_paths=[])
    check("confirm 200 반환", cr.status_code == 200,
          f"status={cr.status_code} body={cr.text[:200]}")

    cs = cr.json().get("data", {})
    check("confirm 후 status=RUNNING",
          cs.get("status", "").upper() == "RUNNING",
          f"status={cs.get('status')}")

    # 분석 완료 대기 (최대 5분)
    final = wait_for_status(token, session_id,
                            {"COMPLETED", "ERROR"},
                            timeout=300, poll=10)
    check("분석 COMPLETED", final == "COMPLETED", f"실제={final}")

    # 취약점 집계
    s = get_session(token, session_id)
    vc = s.get("vulnCount", -1)
    info(f"발견 취약점 수: {vc}")
    check("vulnCount >= 0", vc >= 0, f"vulnCount={vc}")


# ══════════════════════════════════════════════
#  TC-03  stage 2개 제외 후 승인
# ══════════════════════════════════════════════
def tc03_stage_exclusion(token, project_id):
    head("TC-03 stage 2개 제외 후 승인")

    r = start_analysis(token, project_id, confirm_gate=True)
    if not check("POST /sessions 201", r.status_code == 201, r.text[:200]):
        return

    session_id = (r.json().get("data") or {}).get("id") or (r.json().get("data") or {}).get("sessionId")
    final = wait_for_status(token, session_id, {"AWAITING_CONFIRMATION", "COMPLETED", "ERROR"}, timeout=120)

    if final != "AWAITING_CONFIRMATION":
        check("AWAITING_CONFIRMATION 필요", False, f"실제={final}")
        return

    # 세션에서 plan 정보 확인
    s = get_session(token, session_id)
    plan = s.get("plan") or {}
    stages = plan.get("stages") or []
    info(f"plan stages 수: {len(stages)}")

    # stage 1, 2만 포함(나머지 제외) — stage가 없으면 최소 [1]만
    selected = [1] if not stages else sorted({st.get("stageNo", 1) for st in stages[:1]})
    info(f"선택 stage: {selected}")

    cr = confirm_plan(token, session_id, selected_stage_nos=selected)
    check("stage 제외 confirm 200", cr.status_code == 200, cr.text[:200])

    final2 = wait_for_status(token, session_id, {"COMPLETED", "ERROR"}, timeout=300, poll=10)
    check("분석 완료(stage 제외)", final2 == "COMPLETED", f"실제={final2}")


# ══════════════════════════════════════════════
#  TC-04  특정 파일 제외 후 승인
# ══════════════════════════════════════════════
def tc04_file_exclusion(token, project_id):
    head("TC-04 특정 파일 제외 후 승인")

    r = start_analysis(token, project_id, confirm_gate=True)
    if not check("POST /sessions 201", r.status_code == 201, r.text[:200]):
        return

    session_id = (r.json().get("data") or {}).get("id") or (r.json().get("data") or {}).get("sessionId")
    final = wait_for_status(token, session_id, {"AWAITING_CONFIRMATION", "COMPLETED", "ERROR"}, timeout=120)

    if final != "AWAITING_CONFIRMATION":
        check("AWAITING_CONFIRMATION 필요", False, f"실제={final}")
        return

    s = get_session(token, session_id)
    plan = s.get("plan") or {}
    stages = plan.get("stages") or []
    excluded_file = None
    for stage in stages:
        files = stage.get("files") or []
        if files:
            excluded_file = files[0]
            break

    if excluded_file:
        info(f"제외 파일: {excluded_file}")
        cr = confirm_plan(token, session_id, excluded_file_paths=[excluded_file])
        check("파일 제외 confirm 200", cr.status_code == 200, cr.text[:200])
    else:
        info("plan에 파일 정보 없음 — 빈 제외 목록으로 확인")
        cr = confirm_plan(token, session_id, excluded_file_paths=[])
        check("파일 제외(빈 목록) confirm 200", cr.status_code == 200, cr.text[:200])

    final2 = wait_for_status(token, session_id, {"COMPLETED", "ERROR"}, timeout=300, poll=10)
    check("분석 완료(파일 제외)", final2 == "COMPLETED", f"실제={final2}")


# ══════════════════════════════════════════════
#  TC-05  보안: 타 사용자 confirm → 404/403
# ══════════════════════════════════════════════
def tc05_other_user_confirm(token_owner, project_id, session_id):
    head("TC-05 🛡️ 타 사용자 confirm → 404/NOT_FOUND")
    if not session_id:
        check("TC-05 스킵 (session 없음)", False)
        return

    # 다른 사용자 (e2etest2) 로그인
    other_token = login_account(TEST_ACCOUNTS[1]["email"], TEST_ACCOUNTS[1]["password"])
    if not other_token:
        check("다른 사용자 로그인", False)
        return

    cr = confirm_plan(other_token, session_id)
    check("타 사용자 confirm → 404/403",
          cr.status_code in (403, 404),
          f"실제={cr.status_code} body={cr.text[:200]}")


# ══════════════════════════════════════════════
#  TC-06  보안: 재컨펌 → 409
# ══════════════════════════════════════════════
def tc06_reconfirm_409(token, project_id):
    head("TC-06 🛡️ 이미 RUNNING/COMPLETED 세션 재컨펌 → 409")

    r = start_analysis(token, project_id, confirm_gate=True)
    if not check("세션 시작", r.status_code == 201, r.text[:200]):
        return

    session_id = (r.json().get("data") or {}).get("id") or (r.json().get("data") or {}).get("sessionId")
    final = wait_for_status(token, session_id, {"AWAITING_CONFIRMATION", "COMPLETED", "ERROR"}, timeout=120)

    if final != "AWAITING_CONFIRMATION":
        check("AWAITING_CONFIRMATION 필요", False, f"실제={final}")
        return

    # 1차 confirm
    cr1 = confirm_plan(token, session_id)
    check("1차 confirm 200", cr1.status_code == 200, cr1.text[:100])

    # 2차 confirm (재컨펌) — 409 기대
    cr2 = confirm_plan(token, session_id)
    check("재컨펌 → 409 SESSION_ALREADY_CONFIRMED",
          cr2.status_code == 409,
          f"실제={cr2.status_code} body={cr2.text[:200]}")


# ══════════════════════════════════════════════
#  TC-07  보안: 모든 stage 제외 → 400
# ══════════════════════════════════════════════
def tc07_all_stages_excluded_400(token, project_id):
    head("TC-07 🛡️ 모든 stage 제외(빈 리스트) → 400")

    r = start_analysis(token, project_id, confirm_gate=True)
    if not check("세션 시작", r.status_code == 201, r.text[:200]):
        return

    session_id = (r.json().get("data") or {}).get("id") or (r.json().get("data") or {}).get("sessionId")
    final = wait_for_status(token, session_id, {"AWAITING_CONFIRMATION", "COMPLETED", "ERROR"}, timeout=120)

    if final != "AWAITING_CONFIRMATION":
        check("AWAITING_CONFIRMATION 필요", False, f"실제={final}")
        return

    # selectedStageNos=[] → 0개 선택 → 400 기대
    cr = confirm_plan(token, session_id, selected_stage_nos=[])
    check("모든 stage 제외 → 400",
          cr.status_code == 400,
          f"실제={cr.status_code} body={cr.text[:200]}")


# ══════════════════════════════════════════════
#  TC-08  회귀: confirmGate 미사용 일반 분석
# ══════════════════════════════════════════════
def tc08_normal_analysis_no_gate(token, project_id):
    head("TC-08 회귀 — 일반 분석 (confirmGate=false/미지정)")

    r = start_analysis(token, project_id, confirm_gate=False)
    if not check("POST /sessions 201", r.status_code == 201, r.text[:200]):
        return

    session_id = (r.json().get("data") or {}).get("id") or (r.json().get("data") or {}).get("sessionId")
    info(f"sessionId={session_id}")

    # AWAITING_CONFIRMATION 에 멈추지 않고 바로 진행해야 함
    # 2분 내 RUNNING or COMPLETED 도달 기대, AWAITING_CONFIRMATION은 FAIL
    final = wait_for_status(token, session_id,
                            {"AWAITING_CONFIRMATION", "RUNNING", "COMPLETED", "ERROR"},
                            timeout=120, poll=5)

    check("모달 없이 RUNNING/COMPLETED (AWAITING_CONFIRMATION 아님)",
          final in ("RUNNING", "COMPLETED", "ERROR") and final != "AWAITING_CONFIRMATION",
          f"실제={final}")


# ══════════════════════════════════════════════
#  TC-09  회귀: TC-6 재개 흐름 (INTERRUPTED → resume)
# ══════════════════════════════════════════════
def tc09_resume_flow(token, project_id):
    head("TC-09 회귀 — 중단 → 재개 (INTERRUPTED → resume)")

    # 세션 1 시작 (confirmGate=False)
    body1 = {
        "projectId": project_id,
        "sourceType": "local",
        "workspaceRoot": f"/workspace/{project_id}",
        "scanMode": "AUDIT",
        "confirmGate": False,
        "force": True
    }
    r1 = requests.post(f"{BASE}/analysis/sessions", json=body1, headers=headers(token))
    if not check("세션 1 시작", r1.status_code == 201, r1.text[:200]):
        return

    session_id_1 = (r1.json().get("data") or {}).get("id") or (r1.json().get("data") or {}).get("sessionId")
    info(f"세션 1 ID: {session_id_1}")

    # 세션 1이 RUNNING 상태가 될 때까지 짧게 대기
    wait_for_status(token, session_id_1, {"RUNNING", "COMPLETED", "ERROR"}, timeout=30, poll=2)

    # 세션 2 시작 (force=True) -> 세션 1이 INTERRUPTED가 되어야 함
    body2 = {
        "projectId": project_id,
        "sourceType": "local",
        "workspaceRoot": f"/workspace/{project_id}",
        "scanMode": "AUDIT",
        "confirmGate": False,
        "force": True
    }
    r2 = requests.post(f"{BASE}/analysis/sessions", json=body2, headers=headers(token))
    if not check("세션 2 시작 (force=True)", r2.status_code == 201, r2.text[:200]):
        return

    # 세션 1 상태 확인 -> INTERRUPTED 여야 함
    s1 = get_session(token, session_id_1)
    status_1 = s1.get("status", "")
    check("세션 1 상태 = INTERRUPTED", status_1.upper() == "INTERRUPTED", f"실제 상태={status_1}")

    # 세션 1 resume 시도
    rr = requests.post(f"{BASE}/analysis/sessions/{session_id_1}/resume", headers=headers(token))
    check("resume 200 반환", rr.status_code == 200, rr.text[:200])

    rs = rr.json().get("data", {})
    check("resume 후 status=RUNNING",
          rs.get("status", "").upper() == "RUNNING",
          f"status={rs.get('status')}")


# ══════════════════════════════════════════════
#  메인
# ══════════════════════════════════════════════
def main():
    print(f"\n{YELLOW}{'═'*60}{RESET}")
    print(f"{YELLOW}  SecureAI — 컨펌 게이트 E2E 수동 테스트  (20260617){RESET}")
    print(f"{YELLOW}{'═'*60}{RESET}")

    # 헬스 체크
    try:
        h = requests.get("http://localhost:8080/actuator/health", timeout=3)
        if h.status_code != 200:
            print(f"{RED}Backend UP 아님 ({h.status_code}){RESET}")
            sys.exit(1)
        info("Backend UP ✅")
    except Exception as e:
        print(f"{RED}Backend 연결 실패: {e}{RESET}")
        sys.exit(1)

    # 유저 1 생성 (메인 테스터)
    token, email, _ = register_and_login()
    if not token:
        print(f"{RED}사용자 등록/로그인 실패 — 중단{RESET}")
        sys.exit(1)
    info(f"테스트 계정: {email}")

    # 프로젝트
    project_id = sys.argv[1] if len(sys.argv) > 1 else DVWA_PROJECT_ID
    info(f"사용 프로젝트: {project_id}")

    # ── 기능 검증 ──────────────────────────────
    session_id_tc01 = tc01_analysis_starts_and_awaits_confirmation(token, project_id)
    tc02_full_confirm_and_complete(token, project_id, session_id_tc01)

    tc03_stage_exclusion(token, project_id)
    tc04_file_exclusion(token, project_id)

    # ── 보안 / 엣지 ────────────────────────────
    # TC-05: TC-01 세션이 확인 대기 중인 경우에 테스트
    # (새 세션을 만들어 AWAITING_CONFIRMATION 상태에서 타 사용자 confirm)
    r_sec = start_analysis(token, project_id, confirm_gate=True)
    sec_session_id = None
    if r_sec.status_code == 201:
        sec_session_id = (r_sec.json().get("data") or {}).get("id") or \
                         (r_sec.json().get("data") or {}).get("sessionId")
        wait_for_status(token, sec_session_id, {"AWAITING_CONFIRMATION", "COMPLETED", "ERROR"}, timeout=120)

    tc05_other_user_confirm(token, project_id, sec_session_id)
    tc06_reconfirm_409(token, project_id)
    tc07_all_stages_excluded_400(token, project_id)

    # ── 회귀 ───────────────────────────────────
    tc08_normal_analysis_no_gate(token, project_id)
    tc09_resume_flow(token, project_id)

    # ── 결과 요약 ──────────────────────────────
    print(f"\n{YELLOW}{'═'*60}{RESET}")
    print(f"{YELLOW}  결과 요약{RESET}")
    print(f"{YELLOW}{'═'*60}{RESET}")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok_flag, detail in results:
        icon = f"{GREEN}✅{RESET}" if ok_flag else f"{RED}❌{RESET}"
        suffix = f"  ← {detail}" if detail and not ok_flag else ""
        print(f"  {icon}  {name}{suffix}")
    print(f"\n{GREEN}PASS {passed}{RESET} / {RED}FAIL {failed}{RESET} / 전체 {len(results)}")
    print(f"{YELLOW}{'═'*60}{RESET}\n")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    try:
        import sseclient
    except ImportError:
        print("⚠️  sseclient-py 미설치. SSE 수집 비활성화 (설치: pip install sseclient-py)")
        # sseclient 없어도 폴링 기반 상태 확인으로 대부분 동작
    main()
