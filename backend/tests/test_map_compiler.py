import os
from unittest.mock import MagicMock, patch

import pytest

from app.services.map_compiler import convert_to_pbf, run_mkgmap, run_splitter


def _ok_result():
    result = MagicMock()
    result.returncode = 0
    result.stderr = ""
    return result


def _failed_result(stderr="boom"):
    result = MagicMock()
    result.returncode = 1
    result.stderr = stderr
    return result


class TestConvertToPbf:
    def test_builds_osmium_sort_command(self, tmp_path):
        osm_file = str(tmp_path / "map.osm")
        with patch("app.services.map_compiler.subprocess.run", return_value=_ok_result()) as mock_run:
            pbf_path = convert_to_pbf(osm_file, str(tmp_path))

        assert pbf_path == os.path.join(str(tmp_path), "map.osm.pbf")
        cmd = mock_run.call_args.args[0]
        assert cmd[:2] == ["osmium", "sort"]
        assert osm_file in cmd
        assert "-o" in cmd
        assert pbf_path in cmd
        assert "--overwrite" in cmd

    def test_raises_runtime_error_on_nonzero_exit(self, tmp_path):
        with patch(
            "app.services.map_compiler.subprocess.run",
            return_value=_failed_result("bad xml"),
        ):
            with pytest.raises(RuntimeError, match="bad xml"):
                convert_to_pbf(str(tmp_path / "map.osm"), str(tmp_path))


class TestRunSplitter:
    def test_builds_splitter_command_and_creates_output_dir(self, tmp_path):
        osm_file = str(tmp_path / "map.osm.pbf")
        with patch("app.services.map_compiler.subprocess.run", return_value=_ok_result()) as mock_run:
            run_splitter(osm_file, str(tmp_path))

        splitter_dir = os.path.join(str(tmp_path), "splitter_output")
        assert os.path.isdir(splitter_dir)

        cmd = mock_run.call_args.args[0]
        assert cmd[0] == "java"
        assert "-Xmx4g" in cmd
        assert "-jar" in cmd
        assert any(arg.startswith(f"--output-dir={splitter_dir}") for arg in cmd)
        assert osm_file in cmd

    def test_raises_runtime_error_on_nonzero_exit(self, tmp_path):
        with patch(
            "app.services.map_compiler.subprocess.run",
            return_value=_failed_result("splitter died"),
        ):
            with pytest.raises(RuntimeError, match="splitter died"):
                run_splitter(str(tmp_path / "map.osm.pbf"), str(tmp_path))


class TestRunMkgmap:
    def _make_splitter_output(self, tmp_path, with_template_args=False):
        splitter_dir = tmp_path / "splitter_output"
        splitter_dir.mkdir()
        (splitter_dir / "63240001.osm.pbf").write_bytes(b"x")
        if with_template_args:
            (splitter_dir / "template.args").write_text("--mapname=63240001\n")
        return splitter_dir

    def test_raises_file_not_found_when_no_pbf_tiles(self, tmp_path):
        (tmp_path / "splitter_output").mkdir()
        with pytest.raises(FileNotFoundError, match="No PBF tiles"):
            run_mkgmap(str(tmp_path))

    def test_prefers_template_args_when_present(self, tmp_path):
        splitter_dir = self._make_splitter_output(tmp_path, with_template_args=True)
        with patch("app.services.map_compiler.subprocess.run", return_value=_ok_result()) as mock_run:
            run_mkgmap(str(tmp_path))

        cmd = mock_run.call_args.args[0]
        assert "-c" in cmd
        template_args_path = str(splitter_dir / "template.args")
        assert template_args_path in cmd
        # Raw pbf file list must not also be passed when template.args is used
        assert str(splitter_dir / "63240001.osm.pbf") not in cmd

    def test_falls_back_to_raw_pbf_list_without_template_args(self, tmp_path):
        splitter_dir = self._make_splitter_output(tmp_path, with_template_args=False)
        with patch("app.services.map_compiler.subprocess.run", return_value=_ok_result()) as mock_run:
            run_mkgmap(str(tmp_path))

        cmd = mock_run.call_args.args[0]
        assert "-c" not in cmd
        assert str(splitter_dir / "63240001.osm.pbf") in cmd

    def test_builds_expected_gmapsupp_flags(self, tmp_path):
        self._make_splitter_output(tmp_path, with_template_args=True)
        with patch("app.services.map_compiler.subprocess.run", return_value=_ok_result()) as mock_run:
            run_mkgmap(str(tmp_path))

        cmd = mock_run.call_args.args[0]
        assert cmd[0] == "java"
        assert "-Xmx4g" in cmd
        assert "--gmapsupp" in cmd
        assert f"--output-dir={tmp_path}" in cmd
        assert "--route" in cmd
        assert "--index" in cmd

    def test_raises_runtime_error_on_nonzero_exit(self, tmp_path):
        self._make_splitter_output(tmp_path, with_template_args=True)
        with patch(
            "app.services.map_compiler.subprocess.run",
            return_value=_failed_result("mkgmap crashed"),
        ):
            with pytest.raises(RuntimeError, match="mkgmap crashed"):
                run_mkgmap(str(tmp_path))
