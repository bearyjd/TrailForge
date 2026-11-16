from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILES = ["docker-compose.yml", "docker-compose.prod.yml"]


def _services(name):
    return yaml.safe_load((ROOT / name).read_text())["services"]


@pytest.mark.parametrize("name", COMPOSE_FILES)
def test_redis_not_published_to_host(name):
    assert "ports" not in _services(name)["redis"]


@pytest.mark.parametrize("name", COMPOSE_FILES)
def test_redis_requires_password(name):
    command = _services(name)["redis"].get("command", "")
    command = command if isinstance(command, str) else " ".join(command)
    assert "--requirepass" in command
    assert "${REDIS_PASSWORD" in command


@pytest.mark.parametrize("name", COMPOSE_FILES)
@pytest.mark.parametrize("service", ["backend", "worker"])
def test_clients_use_password_in_redis_url(name, service):
    env = _services(name)[service]["environment"]
    url = next(e for e in env if e.startswith("REDIS_URL="))
    assert "${REDIS_PASSWORD" in url
