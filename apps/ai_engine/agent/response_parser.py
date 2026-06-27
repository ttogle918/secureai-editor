"""
Claude SAST 응답 JSON 파서.

Claude가 형식을 지켜도 네트워크 절단·max_tokens 초과로 JSON이
잘릴 수 있다. 3단계 복구 전략으로 가능한 한 결과를 추출한다.

  1. 표준 json.loads
  2. 전체 텍스트에서 {...} 블록 추출 후 재파싱
  3. "vulnerabilities": [...] 배열만 regex로 추출
"""
import json
import logging
import re

logger = logging.getLogger(__name__)


def parse_sast_response(raw: str, file_path: str = "") -> list[dict]:
    """Claude 응답 문자열을 파싱해 취약점 목록을 반환한다."""
    text = raw.strip()

    # 1. 정상 파싱
    try:
        data = json.loads(text)
        return _extract_list(data, file_path)
    except json.JSONDecodeError:
        pass

    # 2. 텍스트 내 JSON 객체 블록 추출
    match = re.search(r'\{[\s\S]*?"vulnerabilities"[\s\S]*?\}', text)
    if match:
        try:
            data = json.loads(match.group())
            return _extract_list(data, file_path)
        except json.JSONDecodeError:
            pass

    # 3. vulnerabilities 배열만 추출 (잘린 JSON 복구)
    match = re.search(r'"vulnerabilities"\s*:\s*(\[[\s\S]*)', text)
    if match:
        fragment = match.group(1)
        # 배열이 닫히는 마지막 ']' 위치까지만 사용
        bracket_depth = 0
        end_idx = len(fragment)
        for i, ch in enumerate(fragment):
            if ch == "[":
                bracket_depth += 1
            elif ch == "]":
                bracket_depth -= 1
                if bracket_depth == 0:
                    end_idx = i + 1
                    break
        try:
            vulns = json.loads(fragment[:end_idx])
            if isinstance(vulns, list):
                logger.info("[parser] recovered %d vulns via fragment for %s", len(vulns), file_path)
                return vulns
        except json.JSONDecodeError:
            pass

    logger.warning("[parser] parse failed for %s — returning fallback ETC", file_path)
    # 파싱에 완전 실패한 경우 (망가진 JSON 등) 데이터 유실을 막기 위해 원시 텍스트를 포함한 ETC 항목을 반환한다.
    return [{
        "vuln_name": "Unparsed / Format Error",
        "type": "ETC",
        "category": "SECURITY",
        "severity": "LOW",
        "line": 1,
        "description": f"AI가 취약점을 감지했으나 응답 형식이 올바르지 않아 파싱에 실패했습니다.\n\n### Raw AI Output:\n```\n{text}\n```"
    }]


def _extract_list(data: dict, file_path: str) -> list[dict]:
    vulns = data.get("vulnerabilities", [])
    if not isinstance(vulns, list):
        logger.warning("[parser] 'vulnerabilities' is not a list for %s", file_path)
        return []
    # category 필드 기본값 보장
    for v in vulns:
        if "category" not in v:
            v["category"] = "SECURITY"
    return vulns
