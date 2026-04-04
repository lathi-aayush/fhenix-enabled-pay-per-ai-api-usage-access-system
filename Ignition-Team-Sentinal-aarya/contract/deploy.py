#!/usr/bin/env python3
"""
Deploy SentinelContract to Algorand TestNet using compiled TEAL from Puya.
Prereqs: pip install -r requirements.txt
Run from contract/: python deploy.py

Env:
  ALGOD_SERVER   (default https://testnet-api.algonode.cloud)
  ALGOD_TOKEN    (optional, empty for public node)
  DEPLOYER_MNEMONIC  — 25-word mnemonic with TestNet ALGO
  SENTINEL_MIN_MICRO_ALGOS — minimum top-up in microAlgos (default 1_000_000)
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")
    load_dotenv()
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
INFO_PATH = ROOT / "contract_info.json"


def _arc4_selector(signature: str) -> bytes:
    return hashlib.new("sha512_256", signature.encode("utf-8")).digest()[:4]


def _subprocess_env_for_puyapy() -> dict:
    """
    PuyaPy resolves imports via shutil.which("python3") then which("python").
    On Windows, Microsoft\\WindowsApps often provides python3.exe / python.exe
    stubs that print "Python was not found" — and python3 is tried first, so
    prepending PATH is not enough if the real install only exposes python.exe.
    Drop WindowsApps from PATH, then prepend this interpreter's directory.
    """
    env = os.environ.copy()
    py_exe = Path(sys.executable).resolve()
    py_dir = str(py_exe.parent)
    raw_path = env.get("PATH", "")
    parts = [
        p
        for p in raw_path.split(os.pathsep)
        if p and "WindowsApps" not in p.replace("/", "\\")
    ]
    env["PATH"] = py_dir + os.pathsep + os.pathsep.join(parts)
    env["PYTHON"] = str(py_exe)
    return env


def _compile_puya() -> bool:
    try:
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                sys.executable,
                "-m",
                "puyapy",
                str(ROOT / "sentinel_contract.py"),
                "--out-dir",
                str(ARTIFACTS),
            ],
            check=True,
            cwd=str(ROOT),
            env=_subprocess_env_for_puyapy(),
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print("[deploy] Puya compile failed:", e)
        return False


def _find_teal() -> tuple[Path | None, Path | None]:
    approval = next(ARTIFACTS.rglob("*approval.teal"), None)
    clear = next(ARTIFACTS.rglob("*clear.teal"), None)
    return approval, clear


def main() -> None:
    from algosdk import mnemonic, transaction
    from algosdk.v2client import algod

    if not _compile_puya():
        print("[deploy] Fix compile errors, then re-run.")
        sys.exit(1)

    approval_path, clear_path = _find_teal()
    if not approval_path or not clear_path:
        print("[deploy] Could not find approval.teal / clear.teal under", ARTIFACTS)
        sys.exit(1)

    approval_teal = approval_path.read_text(encoding="utf-8")
    clear_teal = clear_path.read_text(encoding="utf-8")

    algod_server = os.environ.get("ALGOD_SERVER", "https://testnet-api.algonode.cloud").rstrip("/")
    algod_token = os.environ.get("ALGOD_TOKEN", "")
    deploy_mnemonic = os.environ.get("DEPLOYER_MNEMONIC", "").strip()
    if not deploy_mnemonic:
        print("[deploy] Set DEPLOYER_MNEMONIC in environment or backend/.env")
        sys.exit(1)

    min_micro = int(os.environ.get("SENTINEL_MIN_MICRO_ALGOS", "1000000"))

    try:
        client = algod.AlgodClient(algod_token, algod_server)
        approval_result = client.compile(approval_teal)
        clear_result = client.compile(clear_teal)
        approval_bytes = bytes.fromhex(approval_result["result"])
        clear_bytes = bytes.fromhex(clear_result["result"])

        private_key = mnemonic.to_private_key(deploy_mnemonic)
        sender = mnemonic.to_public_key(deploy_mnemonic)
        suggested = client.suggested_params()

        create_sig = _arc4_selector("create_application(uint64)")
        app_args = [create_sig, min_micro.to_bytes(8, "big")]

        txn = transaction.ApplicationCreateTxn(
            sender=sender,
            sp=suggested,
            on_complete=transaction.OnComplete.NoOpOC,
            approval_program=approval_bytes,
            clear_program=clear_bytes,
            global_schema=transaction.StateSchema(num_uints=3, num_byte_slices=0),
            local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
            app_args=app_args,
        )
        signed = txn.sign(private_key)
        txid = client.send_transaction(signed)
        print("[deploy] Submitted", txid)
        result = transaction.wait_for_confirmation(client, txid, 10)
        app_id = result["application-index"]
        from algosdk.logic import get_application_address

        app_addr = get_application_address(app_id)
        print("[deploy] Application ID:", app_id)
        print("[deploy] Contract (app) address:", app_addr)

        payload = {"appId": int(app_id), "contractAddress": str(app_addr)}
        INFO_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print("[deploy] Wrote", INFO_PATH)
    except Exception as e:
        print("[deploy] Error:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
