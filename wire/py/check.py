"""Build an sdist and wheel, then check the wheel as an isolated typed consumer."""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import tarfile
from tempfile import TemporaryDirectory
import venv
from zipfile import ZipFile


def run(*args: str, cwd: Path, env: dict[str, str]) -> None:
    subprocess.run(args, cwd=cwd, env=env, check=True)


def main() -> None:
    package = Path(__file__).resolve().parent
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)
    with TemporaryDirectory(prefix="bitwire-python-") as directory:
        temporary = Path(directory)
        artifacts = temporary / "dist"
        run(sys.executable, "-m", "build", str(package), "--outdir", str(artifacts), cwd=temporary, env=env)
        wheel, = artifacts.glob("*.whl")
        sdist, = artifacts.glob("*.tar.gz")
        with ZipFile(wheel) as archive:
            names = archive.namelist()
            assert "bitwire/__init__.py" in names
            assert "bitwire/py.typed" in names
            assert any(name.endswith("/licenses/LICENSE") for name in names)
            assert any(name.endswith("/licenses/NOTICE") for name in names)
            metadata, = (name for name in names if name.endswith(".dist-info/METADATA"))
            assert b"Requires-Dist:" not in archive.read(metadata)
        with tarfile.open(sdist) as archive:
            names = archive.getnames()
            assert any(name.endswith("/src/bitwire/py.typed") for name in names)
            assert any(name.endswith("/NOTICE") for name in names)
            assert any(name.endswith("/check.py") for name in names)
            assert any(name.endswith("/tests/typecheck.py") for name in names)

        consumer = temporary / "consumer"
        venv.create(consumer, with_pip=True)
        executable = consumer / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        run(str(executable), "-m", "pip", "install", "--no-index", "--no-deps", str(wheel), cwd=temporary, env=env)
        run(str(executable), "-c", "import bitwire, sys; from pathlib import Path; assert Path(bitwire.__file__).resolve().is_relative_to(Path(sys.prefix).resolve())", cwd=temporary, env=env)
        run(str(executable), "-m", "unittest", "discover", "-s", str(package / "tests"), "-p", "test_*.py", "-v", cwd=temporary, env=env)
        run(sys.executable, "-m", "mypy", "--strict", "--python-version", "3.11", "--python-executable", str(executable), str(package / "tests"), cwd=temporary, env=env)
        print("Python sdist, wheel, installed consumer and PEP 561 typing checks passed.")


if __name__ == "__main__":
    main()
