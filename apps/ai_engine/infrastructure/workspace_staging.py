"""
로컬 워크스페이스 스테이징 — Redis에 저장된 파일을 임시 디렉토리에 기록한다.

workspace_root가 절대경로(/)로 시작하지 않으면 워크스페이스 ID로 간주해
백엔드에서 파일을 가져와 /tmp/secureai-ws-{id}/ 에 저장한다.
"""
import logging
import os
import shutil

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)

_TMP_PREFIX = "/tmp/secureai-ws-"


async def stage_workspace(workspace_id: str) -> str:
    """백엔드에서 파일을 받아 임시 디렉토리에 쓰고 그 경로를 반환한다."""
    tmp_dir = _TMP_PREFIX + workspace_id
    if os.path.exists(tmp_dir):
        logger.info("[workspace-stage] reusing existing %s", tmp_dir)
        return tmp_dir

    url = f"{settings.backend_internal_url}/api/workspace/{workspace_id}/export"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        if resp.status_code == 404:
            raise FileNotFoundError(f"워크스페이스 {workspace_id} 가 백엔드에 없습니다 (만료됐을 수 있습니다).")
        resp.raise_for_status()
        files: dict[str, str] = resp.json()

    os.makedirs(tmp_dir, exist_ok=True)
    for rel_path, content in files.items():
        full_path = os.path.join(tmp_dir, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)

    logger.info("[workspace-stage] staged %d files to %s", len(files), tmp_dir)
    return tmp_dir


def cleanup_staged_workspace(workspace_root: str) -> None:
    """stage_workspace 가 만든 임시 디렉토리를 삭제한다."""
    if workspace_root.startswith(_TMP_PREFIX) and os.path.exists(workspace_root):
        shutil.rmtree(workspace_root, ignore_errors=True)
        logger.info("[workspace-stage] cleaned up %s", workspace_root)


def is_workspace_id(workspace_root: str) -> bool:
    """절대경로가 아니면 워크스페이스 ID로 간주한다."""
    return bool(workspace_root) and not workspace_root.startswith("/")
