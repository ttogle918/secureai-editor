-- team_settings: 팀별 IP 허용 목록 설정 테이블
-- allowed_ip_ranges: CIDR 형식 IP 범위 배열 (JSON 직렬화하여 TEXT로 저장)
CREATE TABLE team_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    allowed_ip_ranges TEXT NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_settings_team_id ON team_settings(team_id);
